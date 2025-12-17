"use client"

import { useState, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ImageIcon, ArrowRight, Sparkles } from "lucide-react"
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
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false)
  const [scriptAdaptation, setScriptAdaptation] = useState<ScriptAdaptation | null>(null)
  const [showResults, setShowResults] = useState(false)

  // 영상 대본 자동 가져오기
  const handleLoadTranscript = async () => {
    if (!videoId) {
      alert("영상 ID가 없습니다.")
      return
    }

    setIsLoadingTranscript(true)
    try {
      console.log("[Frontend] 대본 가져오기 시작:", videoId)
      const response = await fetch("/api/youmaker/get-video-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId }),
      })

      const data = await response.json()
      console.log("[Frontend] 대본 가져오기 응답:", data)

      if (!response.ok) {
        throw new Error(data.error || data.message || "대본을 가져오는데 실패했습니다.")
      }

      if (data.success && data.hasCaptions && data.transcript) {
        setScriptInput(data.transcript)
        alert(`영상 대본을 성공적으로 가져왔습니다. (${data.transcript.length}자)`)
      } else {
        alert(data.message || data.error || "이 영상에는 자막이 없습니다.")
      }
    } catch (error) {
      console.error("대본 가져오기 실패:", error)
      alert(error instanceof Error ? error.message : "대본을 가져오는데 실패했습니다.")
    } finally {
      setIsLoadingTranscript(false)
    }
  }

  // 대본 각색 실행
  const handleScriptAdaptation = async () => {
    if (!scriptInput.trim()) {
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

      // API 호출로 실제 대본 각색 수행
      const response = await fetch("/api/youmaker/adapt-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: scriptInput,
          geminiApiKey,
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
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push(`/youmaker/comment-analysis?videoId=${videoId}&title=${encodeURIComponent(videoTitle || "")}`)}
            className="mb-4"
          >
            ← 이전 단계
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">대본 입력 및 각색</CardTitle>
              <p className="text-sm text-slate-600 mt-2">{videoTitle || "영상 제목"}</p>
            </CardHeader>
          </Card>

          {!showResults ? (
            <>
              {/* 대본 입력 섹션 */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <span className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white flex items-center justify-center text-lg font-bold shadow-lg">
                      1
                    </span>
                    대본 입력
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                      <Label htmlFor="script" className="text-base font-semibold">
                        벤치마킹할 대본을 입력하세요
                      </Label>
                    <p className="text-sm text-slate-600 mt-1 mb-4">
                      참고할 벤치마킹 대본을 직접 입력해주세요. AI가 이를 기반으로 각색하고 제목, 썸네일 문구를 생성합니다.
                    </p>
                    <Textarea
                      id="script"
                      placeholder="벤치마킹할 대본을 입력하세요..."
                      value={scriptInput}
                      onChange={(e) => setScriptInput(e.target.value)}
                      className="min-h-[300px] text-base"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={handleScriptAdaptation}
                      disabled={isLoading || !scriptInput.trim()}
                      size="lg"
                      className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                    >
                      {isLoading ? (
                        <>
                          <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                          각색 중...
                        </>
                      ) : (
                        <>
                          대본 각색 시작
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {isLoading && (
                <Card className="border-0 shadow-lg">
                  <CardContent className="py-12 text-center">
                    <Sparkles className="w-8 h-8 mx-auto mb-4 animate-spin text-orange-500" />
                    <p className="text-slate-600">대본을 각색하고 있습니다...</p>
                    <p className="text-sm text-slate-500 mt-2">잠시만 기다려주세요.</p>
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
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <span className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white flex items-center justify-center text-lg font-bold shadow-lg">
                          1
                        </span>
                        원본 대본 정리 및 교정
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                        <pre className="whitespace-pre-wrap text-slate-900 text-base leading-relaxed">
                          {scriptAdaptation.cleanedScript}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Step 2: 핵심 내용 요약 */}
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <span className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white flex items-center justify-center text-lg font-bold shadow-lg">
                          2
                        </span>
                        핵심 내용 요약
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-sm font-semibold text-slate-600 mb-2 block">핵심 제목</Label>
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-slate-900 font-semibold">{scriptAdaptation.summary.title}</p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-semibold text-slate-600 mb-2 block">핵심 메시지</Label>
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                          <p className="text-slate-900">{scriptAdaptation.summary.coreMessage}</p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-semibold text-slate-600 mb-2 block">논리적 구조</Label>
                        <div className="space-y-2">
                          {scriptAdaptation.summary.structure.map((point, index) => (
                            <div
                              key={index}
                              className="p-3 bg-purple-50 rounded-lg border border-purple-200"
                            >
                              <p className="text-slate-900">{index + 1}. {point}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-semibold text-slate-600 mb-2 block">요약 포인트</Label>
                        <div className="space-y-2">
                          {scriptAdaptation.summary.summaryPoints.map((point, index) => (
                            <div
                              key={index}
                              className="p-3 bg-amber-50 rounded-lg border border-amber-200"
                            >
                              <p className="text-slate-900">{index + 1}. {point}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Step 3: 새로운 대본 재창조 */}
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <span className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white flex items-center justify-center text-lg font-bold shadow-lg">
                          3
                        </span>
                        새로운 대본 재창조
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                        <pre className="whitespace-pre-wrap text-slate-900 text-base leading-relaxed">
                          {scriptAdaptation.adaptedScript}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Step 4: 제목 생성 */}
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <span className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white flex items-center justify-center text-lg font-bold shadow-lg">
                          4
                        </span>
                        클릭 유도형 제목 생성
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-sm font-semibold text-slate-600">호기심 자극형 (5개)</Label>
                        <div className="mt-2 space-y-2">
                          {scriptAdaptation.titles.fresh.map((title, index) => (
                            <div
                              key={index}
                              className="p-4 bg-gradient-to-r from-pink-50 to-rose-50 rounded-lg border border-pink-200"
                            >
                              <p className="text-slate-900 font-medium">{title}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-semibold text-slate-600">이득 제시형 (5개)</Label>
                        <div className="mt-2 space-y-2">
                          {scriptAdaptation.titles.stable.map((title, index) => (
                            <div
                              key={index}
                              className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200"
                            >
                              <p className="text-slate-900 font-medium">{title}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Step 5: 썸네일 문구 제작 */}
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <span className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white flex items-center justify-center text-lg font-bold shadow-lg">
                          5
                        </span>
                        썸네일 문구 제작
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-sm font-semibold text-slate-600">Emotional (감정)</Label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {scriptAdaptation.thumbnailTexts.emotional.map((text, index) => (
                            <Badge
                              key={index}
                              className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:from-pink-600 hover:to-rose-600 text-sm"
                            >
                              {text}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-semibold text-slate-600">Informational (정보)</Label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {scriptAdaptation.thumbnailTexts.informational.map((text, index) => (
                            <Badge
                              key={index}
                              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 text-sm"
                            >
                              {text}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-semibold text-slate-600">Visual (시각적 지침)</Label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {scriptAdaptation.thumbnailTexts.visual.map((text, index) => (
                            <Badge
                              key={index}
                              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 text-sm"
                            >
                              {text}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 다음 단계 버튼 */}
                  <div className="flex justify-end gap-4">
                    <Button
                      onClick={() => {
                        setShowResults(false)
                        setScriptAdaptation(null)
                      }}
                      variant="outline"
                      size="lg"
                    >
                      다시 입력하기
                    </Button>
                    <Button
                      onClick={handleNextStep}
                      disabled={isLoading}
                      size="lg"
                      className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                    >
                      <ImageIcon className="w-4 h-4 mr-2" />
                      썸네일 생성 시작
                      <ArrowRight className="w-4 h-4 ml-2" />
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

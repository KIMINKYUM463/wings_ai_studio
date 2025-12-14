"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ImageIcon, ArrowRight, Sparkles } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

interface ScriptAdaptation {
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

export default function ScriptBenchmarkingPage() {
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
      // TODO: API 호출로 실제 대본 각색 수행
      // 임시 데이터
      await new Promise((resolve) => setTimeout(resolve, 2000)) // 로딩 시뮬레이션

      const mockScriptAdaptation: ScriptAdaptation = {
        adaptedScript: `[각색된 대본]\n\n${scriptInput}\n\n위 대본을 기반으로 AI가 각색한 새로운 대본입니다. 원본의 핵심 메시지는 유지하면서 더욱 매력적이고 몰입감 있는 구성으로 재구성되었습니다.`,
        titles: {
          fresh: [
            "이걸 아직도 모른다고?",
            "충격적인 진실",
            "이것 때문에 실패했다",
            "99%가 모르는 비밀",
            "이제서야 알았다",
          ],
          stable: [
            "월 100만 원 더 버는 법 TOP 3",
            "초보자를 위한 완벽 가이드",
            "5분만에 배우는 핵심 노하우",
            "실전 활용법 완벽 정리",
            "단계별 상세 가이드",
          ],
        },
        thumbnailTexts: {
          emotional: ["충격", "결국 터졌다", "믿을 수 없어", "눈물", "감동"],
          informational: ["수익 3배 증가", "5분 완성", "100% 성공", "확실한 방법", "검증됨"],
          visual: ["이미지만으로 충분히 전달", "강렬한 색상", "대비 효과", "시각적 임팩트"],
        },
      }

      setScriptAdaptation(mockScriptAdaptation)
      setShowResults(true)
    } catch (error) {
      console.error("대본 각색 실패:", error)
      alert("대본 각색에 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleNextStep = () => {
    if (scriptAdaptation) {
      // 각색된 대본과 제목, 썸네일 문구를 쿼리 파라미터로 전달
      const params = new URLSearchParams({
        videoId: videoId || "",
        title: videoTitle || "",
        adaptedScript: encodeURIComponent(scriptAdaptation.adaptedScript),
        titles: encodeURIComponent(JSON.stringify(scriptAdaptation.titles)),
        thumbnailTexts: encodeURIComponent(JSON.stringify(scriptAdaptation.thumbnailTexts)),
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
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="script" className="text-base font-semibold">
                        벤치마킹할 대본을 입력하세요
                      </Label>
                      <Button
                        onClick={handleLoadTranscript}
                        disabled={isLoadingTranscript || !videoId}
                        variant="outline"
                        size="sm"
                        className="text-sm"
                      >
                        {isLoadingTranscript ? (
                          <>
                            <Sparkles className="w-3 h-3 mr-1 animate-spin" />
                            가져오는 중...
                          </>
                        ) : (
                          "영상 대본 자동 가져오기"
                        )}
                      </Button>
                    </div>
                    <p className="text-sm text-slate-600 mt-1 mb-4">
                      분석한 영상의 대본을 입력하거나, 참고할 대본을 입력해주세요. AI가 이를 기반으로 각색하고 제목, 썸네일 문구를 생성합니다. 또는 '영상 대본 자동 가져오기' 버튼을 클릭하여 선택한 영상의 대본을 자동으로 가져올 수 있습니다.
                    </p>
                    <Textarea
                      id="script"
                      placeholder="대본을 입력하세요... 또는 '영상 대본 자동 가져오기' 버튼을 클릭하여 선택한 영상의 대본을 자동으로 가져올 수 있습니다."
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
                  {/* Step 2: 각색된 대본 */}
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <span className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white flex items-center justify-center text-lg font-bold shadow-lg">
                          2
                        </span>
                        각색된 대본
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

                  {/* Step 3: 제목 생성 */}
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <span className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white flex items-center justify-center text-lg font-bold shadow-lg">
                          3
                        </span>
                        제목 생성
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-sm font-semibold text-slate-600">Fresh (호기심/도발)</Label>
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
                        <Label className="text-sm font-semibold text-slate-600">Stable (정보/이득)</Label>
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

                  {/* Step 4: 썸네일 문구 생성 */}
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <span className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white flex items-center justify-center text-lg font-bold shadow-lg">
                          4
                        </span>
                        썸네일 문구 생성
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

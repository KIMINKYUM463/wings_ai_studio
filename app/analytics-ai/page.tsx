"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, TrendingUp, AlertCircle, CheckCircle, ArrowLeft, Home } from "lucide-react"
import Link from "next/link"
import { analyzeShortMetrics, analyzeLongMetrics } from "./actions"

export default function AnalyticsAIPage() {
  const [activeTab, setActiveTab] = useState<"short" | "long">("short")

  // 숏폼 상태
  const [shortScript, setShortScript] = useState("")
  const [shortMetricsImage, setShortMetricsImage] = useState<File | null>(null)
  const [shortThumbnail, setShortThumbnail] = useState<File | null>(null)
  const [shortAnalysis, setShortAnalysis] = useState<any>(null)
  const [shortAnalyzing, setShortAnalyzing] = useState(false)

  // 롱폼 상태
  const [longScript, setLongScript] = useState("")
  const [longMetricsImage, setLongMetricsImage] = useState<File | null>(null)
  const [longThumbnail, setLongThumbnail] = useState<File | null>(null)
  const [longAnalysis, setLongAnalysis] = useState<any>(null)
  const [longAnalyzing, setLongAnalyzing] = useState(false)

  const handleShortAnalysis = async () => {
    if (!shortScript || !shortMetricsImage || !shortThumbnail) {
      alert("모든 항목을 입력해주세요.")
      return
    }

    setShortAnalyzing(true)
    try {
      const result = await analyzeShortMetrics(shortScript, shortMetricsImage, shortThumbnail)
      setShortAnalysis(result)
    } catch (error) {
      console.error("분석 실패:", error)
      alert("분석에 실패했습니다. 다시 시도해주세요.")
    } finally {
      setShortAnalyzing(false)
    }
  }

  const handleLongAnalysis = async () => {
    if (!longScript || !longMetricsImage || !longThumbnail) {
      alert("모든 항목을 입력해주세요.")
      return
    }

    setLongAnalyzing(true)
    try {
      const result = await analyzeLongMetrics(longScript, longMetricsImage, longThumbnail)
      setLongAnalysis(result)
    } catch (error) {
      console.error("분석 실패:", error)
      alert("분석에 실패했습니다. 다시 시도해주세요.")
    } finally {
      setLongAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" size="icon">
                <Home className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <TrendingUp className="w-10 h-10 text-primary" />
                지표분석AI
              </h1>
              <p className="text-muted-foreground mt-2">영상 지표를 AI가 분석하여 개선 방안을 제시합니다</p>
            </div>
          </div>
        </div>

        {/* 탭 */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "short" | "long")} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="short">숏폼</TabsTrigger>
            <TabsTrigger value="long">롱폼</TabsTrigger>
          </TabsList>

          {/* 숏폼 탭 */}
          <TabsContent value="short">
            <div className="grid md:grid-cols-2 gap-8">
              {/* 입력 섹션 */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>대본 입력</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="숏폼 대본을 입력하세요..."
                      value={shortScript}
                      onChange={(e) => setShortScript(e.target.value)}
                      rows={8}
                      className="resize-none"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>유튜브 지표 캡쳐본</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      시청자 참여도와 시청지속시간이 포함된 캡쳐본을 업로드하세요
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setShortMetricsImage(e.target.files?.[0] || null)}
                        className="hidden"
                        id="short-metrics"
                      />
                      <label htmlFor="short-metrics" className="cursor-pointer">
                        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {shortMetricsImage ? shortMetricsImage.name : "클릭하여 이미지 업로드"}
                        </p>
                      </label>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>썸네일</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setShortThumbnail(e.target.files?.[0] || null)}
                        className="hidden"
                        id="short-thumbnail"
                      />
                      <label htmlFor="short-thumbnail" className="cursor-pointer">
                        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {shortThumbnail ? shortThumbnail.name : "클릭하여 썸네일 업로드"}
                        </p>
                      </label>
                    </div>
                  </CardContent>
                </Card>

                <Button
                  onClick={handleShortAnalysis}
                  disabled={shortAnalyzing || !shortScript || !shortMetricsImage || !shortThumbnail}
                  className="w-full"
                  size="lg"
                >
                  {shortAnalyzing ? "분석 중..." : "AI 분석 시작"}
                </Button>
              </div>

              {/* 결과 섹션 */}
              <div>
                {shortAnalyzing && (
                  <Card>
                    <CardHeader>
                      <CardTitle>AI 분석 중...</CardTitle>
                      <p className="text-sm text-muted-foreground">업로드된 자료를 스캔하고 있습니다</p>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        {/* 지표 이미지 스캔 */}
                        {shortMetricsImage && (
                          <div className="scanning-image-container" style={{ animationDelay: "0s" }}>
                            <div className="relative">
                              <img
                                src={URL.createObjectURL(shortMetricsImage) || "/placeholder.svg"}
                                alt="지표 스캔 중"
                                className="w-full h-64 object-contain rounded-lg bg-muted"
                              />
                              <div className="scan-line"></div>
                            </div>
                            <p className="text-sm text-center mt-2 text-muted-foreground">유튜브 지표 분석 중...</p>
                          </div>
                        )}

                        {/* 썸네일 스캔 */}
                        {shortThumbnail && (
                          <div className="scanning-image-container" style={{ animationDelay: "0.5s" }}>
                            <div className="relative">
                              <img
                                src={URL.createObjectURL(shortThumbnail) || "/placeholder.svg"}
                                alt="썸네일 스캔 중"
                                className="w-full h-64 object-contain rounded-lg bg-muted"
                              />
                              <div className="scan-line" style={{ animationDelay: "0.5s" }}></div>
                            </div>
                            <p className="text-sm text-center mt-2 text-muted-foreground">썸네일 분석 중...</p>
                          </div>
                        )}
                      </div>

                      <div className="scanning-image-container" style={{ animationDelay: "1s" }}>
                        <div className="bg-muted p-6 rounded-lg relative overflow-hidden">
                          <div className="scan-line" style={{ animationDelay: "1s" }}></div>
                          <p className="text-sm font-mono line-clamp-6">{shortScript}</p>
                        </div>
                        <p className="text-sm text-center mt-2 text-muted-foreground">대본 분석 중...</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {shortAnalysis && !shortAnalyzing && (
                  <Card>
                    <CardHeader>
                      <CardTitle>분석 결과</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* 시청자 참여도 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold">시청자 참여도</h3>
                          <span
                            className={`font-bold ${shortAnalysis.engagement >= 60 ? "text-green-600" : "text-red-600"}`}
                          >
                            {shortAnalysis.engagement}%
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          {shortAnalysis.engagement >= 60 ? (
                            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                          )}
                          <p className="text-sm text-muted-foreground">{shortAnalysis.engagementAnalysis}</p>
                        </div>
                      </div>

                      {shortAnalysis.engagement < 60 && shortAnalysis.thumbnailSuggestions?.length > 0 && (
                        <div>
                          <h3 className="font-semibold mb-3">추천 썸네일 문구</h3>
                          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg space-y-2">
                            {shortAnalysis.thumbnailSuggestions.map((suggestion: string, index: number) => (
                              <div key={index} className="flex items-start gap-2">
                                <span className="text-blue-600 font-semibold min-w-[24px]">{index + 1}.</span>
                                <span className="text-sm text-blue-900">{suggestion}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 시청지속시간 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold">시청지속시간</h3>
                          <span
                            className={`font-bold ${shortAnalysis.retention >= 100 ? "text-green-600" : "text-red-600"}`}
                          >
                            {shortAnalysis.retention}%
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          {shortAnalysis.retention >= 100 ? (
                            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                          )}
                          <p className="text-sm text-muted-foreground">{shortAnalysis.retentionAnalysis}</p>
                        </div>
                      </div>

                      {shortAnalysis.retention < 100 && shortAnalysis.scriptIssues && (
                        <div>
                          <h3 className="font-semibold mb-2">대본 문제점 및 피해야 할 스타일</h3>
                          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                            <p className="text-sm text-red-800 whitespace-pre-wrap">{shortAnalysis.scriptIssues}</p>
                          </div>
                        </div>
                      )}

                      {/* 개선 제안 */}
                      <div>
                        <h3 className="font-semibold mb-2">개선 제안</h3>
                        <div className="bg-muted p-4 rounded-lg">
                          <p className="text-sm whitespace-pre-wrap">{shortAnalysis.suggestions}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* 롱폼 탭 */}
          <TabsContent value="long">
            <div className="grid md:grid-cols-2 gap-8">
              {/* 입력 섹션 */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>대본 입력</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="롱폼 대본을 입력하세요..."
                      value={longScript}
                      onChange={(e) => setLongScript(e.target.value)}
                      rows={8}
                      className="resize-none"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>유튜브 지표 캡쳐본</CardTitle>
                    <p className="text-sm text-muted-foreground">시청지속시간이 포함된 캡쳐본을 업로드하세요</p>
                  </CardHeader>
                  <CardContent>
                    <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setLongMetricsImage(e.target.files?.[0] || null)}
                        className="hidden"
                        id="long-metrics"
                      />
                      <label htmlFor="long-metrics" className="cursor-pointer">
                        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {longMetricsImage ? longMetricsImage.name : "클릭하여 이미지 업로드"}
                        </p>
                      </label>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>썸네일</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setLongThumbnail(e.target.files?.[0] || null)}
                        className="hidden"
                        id="long-thumbnail"
                      />
                      <label htmlFor="long-thumbnail" className="cursor-pointer">
                        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {longThumbnail ? longThumbnail.name : "클릭하여 썸네일 업로드"}
                        </p>
                      </label>
                    </div>
                  </CardContent>
                </Card>

                <Button
                  onClick={handleLongAnalysis}
                  disabled={longAnalyzing || !longScript || !longMetricsImage || !longThumbnail}
                  className="w-full"
                  size="lg"
                >
                  {longAnalyzing ? "분석 중..." : "AI 분석 시작"}
                </Button>
              </div>

              {/* 결과 섹션 */}
              <div>
                {longAnalyzing && (
                  <Card>
                    <CardHeader>
                      <CardTitle>AI 분석 중...</CardTitle>
                      <p className="text-sm text-muted-foreground">업로드된 자료를 스캔하고 있습니다</p>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        {/* 지표 이미지 스캔 */}
                        {longMetricsImage && (
                          <div className="scanning-image-container" style={{ animationDelay: "0s" }}>
                            <div className="relative">
                              <img
                                src={URL.createObjectURL(longMetricsImage) || "/placeholder.svg"}
                                alt="지표 스캔 중"
                                className="w-full h-64 object-contain rounded-lg bg-muted"
                              />
                              <div className="scan-line"></div>
                            </div>
                            <p className="text-sm text-center mt-2 text-muted-foreground">유튜브 지표 분석 중...</p>
                          </div>
                        )}

                        {/* 썸네일 스캔 */}
                        {longThumbnail && (
                          <div className="scanning-image-container" style={{ animationDelay: "0.5s" }}>
                            <div className="relative">
                              <img
                                src={URL.createObjectURL(longThumbnail) || "/placeholder.svg"}
                                alt="썸네일 스캔 중"
                                className="w-full h-64 object-contain rounded-lg bg-muted"
                              />
                              <div className="scan-line" style={{ animationDelay: "0.5s" }}></div>
                            </div>
                            <p className="text-sm text-center mt-2 text-muted-foreground">썸네일 분석 중...</p>
                          </div>
                        )}
                      </div>

                      <div className="scanning-image-container" style={{ animationDelay: "1s" }}>
                        <div className="bg-muted p-6 rounded-lg relative overflow-hidden">
                          <div className="scan-line" style={{ animationDelay: "1s" }}></div>
                          <p className="text-sm font-mono line-clamp-6">{longScript}</p>
                        </div>
                        <p className="text-sm text-center mt-2 text-muted-foreground">대본 분석 중...</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {longAnalysis && !longAnalyzing && (
                  <Card>
                    <CardHeader>
                      <CardTitle>분석 결과</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* 시청지속시간 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold">시청지속시간</h3>
                          <span
                            className={`font-bold ${longAnalysis.retention >= 30 ? "text-green-600" : "text-red-600"}`}
                          >
                            {longAnalysis.retention}%
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          {longAnalysis.retention >= 30 ? (
                            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                          )}
                          <p className="text-sm text-muted-foreground">{longAnalysis.retentionAnalysis}</p>
                        </div>
                      </div>

                      {longAnalysis.retention < 30 && longAnalysis.hookingAnalysis && (
                        <div>
                          <h3 className="font-semibold mb-2">후킹 분석 (첫 1분 30초)</h3>
                          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                            <p className="text-sm text-red-800 whitespace-pre-wrap">{longAnalysis.hookingAnalysis}</p>
                          </div>
                        </div>
                      )}

                      {longAnalysis.retention < 30 && longAnalysis.scriptIssues && (
                        <div>
                          <h3 className="font-semibold mb-2">대본 문제점 및 피해야 할 스타일</h3>
                          <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                            <p className="text-sm text-orange-800 whitespace-pre-wrap">{longAnalysis.scriptIssues}</p>
                          </div>
                        </div>
                      )}

                      {longAnalysis.thumbnailFeedback && (
                        <div>
                          <h3 className="font-semibold mb-2">썸네일 분석</h3>
                          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                            <p className="text-sm text-blue-800 whitespace-pre-wrap">
                              {longAnalysis.thumbnailFeedback}
                            </p>
                          </div>
                        </div>
                      )}

                      {longAnalysis.thumbnailSuggestions?.length > 0 && (
                        <div>
                          <h3 className="font-semibold mb-3">추천 썸네일 문구</h3>
                          <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg space-y-2">
                            {longAnalysis.thumbnailSuggestions.map((suggestion: string, index: number) => (
                              <div key={index} className="flex items-start gap-2">
                                <span className="text-purple-600 font-semibold min-w-[24px]">{index + 1}.</span>
                                <span className="text-sm text-purple-900">{suggestion}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 개선 제안 */}
                      <div>
                        <h3 className="font-semibold mb-2">개선 제안</h3>
                        <div className="bg-muted p-4 rounded-lg">
                          <p className="text-sm whitespace-pre-wrap">{longAnalysis.suggestions}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

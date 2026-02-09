"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Zap,
  Settings,
  Sparkles,
  Image as ImageIcon,
  Upload,
  ArrowLeft,
  PenTool,
  Save,
  FolderOpen,
  Info,
  Loader2,
} from "lucide-react"

function BlogAIPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const keywordFromQuery = searchParams.get("keyword") || ""

  // 상태 관리
  const [keyword, setKeyword] = useState(keywordFromQuery)
  const [workflow, setWorkflow] = useState<"automation" | "custom">("automation")
  const [imageMode, setImageMode] = useState<"ai" | "wash">("ai")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState("")

  // 커스텀 모드 페르소나 정보
  const [personaInfo, setPersonaInfo] = useState({
    businessName: "",
    industry: "",
    representativeName: "",
    salesLocation: "",
    differentiator: "",
    customerCharacteristics: "",
  })

  // 이미지 세탁 옵션
  const [washOptions, setWashOptions] = useState({
    transparentOverlay: false,
    angleRotation: false,
    frame: false,
  })

  const [uploadedImages, setUploadedImages] = useState<File[]>([])

  // URL에서 키워드 가져오기
  useEffect(() => {
    if (keywordFromQuery) {
      setKeyword(keywordFromQuery)
    }
  }, [keywordFromQuery])

  // 이미지 업로드 처리
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setUploadedImages((prev) => [...prev, ...files])
  }

  // 드래그 앤 드롭 처리
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    setUploadedImages((prev) => [...prev, ...files])
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  // AI 콘텐츠 생성
  const handleGenerateContent = async () => {
    if (!keyword.trim()) {
      alert("키워드를 입력해주세요.")
      return
    }

    setIsGenerating(true)
    setGeneratedContent("")

    try {
      // OpenAI API 키 (하드코딩)
      const OPENAI_API_KEY = "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"

      let prompt = ""

      if (workflow === "automation") {
        // 자동화 모드: 머니테이커 블로그 공식 적용
        prompt = `다음 키워드로 블로그 글을 작성해주세요. 머니테이커의 블로그 공식을 적용하여 키워드 상위노출과 전환을 동시에 잡는 글을 작성해주세요.

키워드: ${keyword}

요구사항:
1. SEO 최적화된 제목과 본문
2. 독자의 니즈를 정확히 파악한 콘텐츠
3. 자연스러운 키워드 배치
4. 행동 유도(CTA) 포함
5. 전문적이면서도 읽기 쉬운 문체

2000자 이상의 상세한 블로그 글을 작성해주세요.`
      } else {
        // 커스텀 모드: 페르소나 정보 활용
        prompt = `다음 정보를 바탕으로 블로그 글을 작성해주세요.

키워드: ${keyword}
사업체명: ${personaInfo.businessName || "미입력"}
업종: ${personaInfo.industry || "미입력"}
대표명: ${personaInfo.representativeName || "미입력"}
판매 위치: ${personaInfo.salesLocation || "미입력"}
업체 차별점: ${personaInfo.differentiator || "미입력"}
고객 특징: ${personaInfo.customerCharacteristics || "미입력"}

요구사항:
1. 페르소나 정보를 활용한 맞춤형 콘텐츠
2. 업체 차별점을 강조
3. 타겟 고객층에게 어필하는 내용
4. 전환율 극대화를 위한 설득력 있는 문구
5. 자연스러운 키워드 배치

2000자 이상의 전문적인 블로그 글을 작성해주세요.`
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "당신은 블로그 콘텐츠 전문 작가입니다. SEO 최적화와 전환율을 고려한 고품질 블로그 글을 작성합니다.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || "콘텐츠 생성에 실패했습니다.")
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || "콘텐츠를 생성할 수 없습니다."

      setGeneratedContent(content)
    } catch (error) {
      console.error("콘텐츠 생성 실패:", error)
      alert(error instanceof Error ? error.message : "콘텐츠 생성에 실패했습니다.")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-6 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push("/moneytaker")}
            className="text-slate-300 hover:text-white hover:bg-slate-800 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            키워드 분석으로 돌아가기
          </Button>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            당신의 글을 수익으로 전환하세요
          </h1>
          <p className="text-slate-400 text-lg">
            AI 기반 콘텐츠 생성, 즉각적인 상위 노출 결과
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* 왼쪽: 설정 영역 */}
          <div className="col-span-7 space-y-6">
            {/* Step 1: 키워드 입력 */}
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-emerald-400 mb-4">
                  Step 1. 키워드를 입력하세요
                </h2>
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="예: 강남한의원"
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-emerald-500"
                />
              </CardContent>
            </Card>

            {/* Step 2: 워크플로우 선택 */}
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-emerald-400 mb-4">
                  Step 2. 워크플로우를 선택하세요
                </h2>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <button
                    onClick={() => setWorkflow("automation")}
                    className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                      workflow === "automation"
                        ? "border-emerald-500 bg-emerald-500/10 text-white"
                        : "border-slate-600 bg-slate-700/30 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    <Zap className="w-6 h-6 mb-2 mx-auto" />
                    <div className="font-semibold">자동화 모드</div>
                  </button>
                  <button
                    onClick={() => setWorkflow("custom")}
                    className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                      workflow === "custom"
                        ? "border-emerald-500 bg-emerald-500/10 text-white"
                        : "border-slate-600 bg-slate-700/30 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    <Settings className="w-6 h-6 mb-2 mx-auto" />
                    <div className="font-semibold">커스텀 모드</div>
                  </button>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4 flex items-start gap-3">
                  <Info className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-slate-300">
                    {workflow === "automation"
                      ? "머니테이커만의 블로그 공식을 적용하여, 키워드 상위노출과 전환을 동시에 잡는 글을 자동으로 완성합니다."
                      : "페르소나 정보를 직접 입력하여 전환율을 극대화하는 커스텀 전문 콘텐츠를 생성합니다."}
                  </p>
                </div>

                {/* 커스텀 모드: 페르소나 정보 입력 */}
                {workflow === "custom" && (
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-emerald-400">페르소나 정보 입력</h3>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          저장하기
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-600 text-slate-300 hover:bg-slate-700"
                        >
                          <FolderOpen className="w-4 h-4 mr-2" />
                          불러오기
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-slate-400 mb-2 block">사업체명</label>
                        <Input
                          value={personaInfo.businessName}
                          onChange={(e) =>
                            setPersonaInfo({ ...personaInfo, businessName: e.target.value })
                          }
                          placeholder="ex) 강남한의원"
                          className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400 mb-2 block">업종</label>
                        <Input
                          value={personaInfo.industry}
                          onChange={(e) =>
                            setPersonaInfo({ ...personaInfo, industry: e.target.value })
                          }
                          placeholder="ex) 한의원"
                          className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400 mb-2 block">대표명</label>
                        <Input
                          value={personaInfo.representativeName}
                          onChange={(e) =>
                            setPersonaInfo({ ...personaInfo, representativeName: e.target.value })
                          }
                          placeholder="ex) 홍길동"
                          className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400 mb-2 block">판매 위치</label>
                        <Input
                          value={personaInfo.salesLocation}
                          onChange={(e) =>
                            setPersonaInfo({ ...personaInfo, salesLocation: e.target.value })
                          }
                          placeholder="ex) 서울 강남구"
                          className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-slate-400 mb-2 block">업체 차별점</label>
                      <Textarea
                        value={personaInfo.differentiator}
                        onChange={(e) =>
                          setPersonaInfo({ ...personaInfo, differentiator: e.target.value })
                        }
                        placeholder="ex) 초진 시 30분 이상 1:1 맞춤 상담으로 증상·생활습관·체질을 함께 분석합니다."
                        className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 min-h-[100px]"
                      />
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        차별점은 숫자로 표현될 수 있는 것이 좋습니다.
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-slate-400 mb-2 block">고객 특징</label>
                      <Textarea
                        value={personaInfo.customerCharacteristics}
                        onChange={(e) =>
                          setPersonaInfo({ ...personaInfo, customerCharacteristics: e.target.value })
                        }
                        placeholder="ex) 서울에 거주하거나 근무하며 만성 통증·근골격계 질환으로 일상에 불편을 겪는 20~60대입니다."
                        className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 min-h-[100px]"
                      />
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        "누가 / 어떤 상태에서 / 왜 찾아오는지" 한 문장에 담아주세요.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 3: 이미지 생성 방식 */}
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-emerald-400 mb-4">
                  Step 3. 이미지 생성 방식을 선택하세요
                </h2>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <button
                    onClick={() => setImageMode("ai")}
                    className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                      imageMode === "ai"
                        ? "border-emerald-500 bg-emerald-500/10 text-white"
                        : "border-slate-600 bg-slate-700/30 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    <Sparkles className="w-6 h-6 mb-2 mx-auto" />
                    <div className="font-semibold">AI 생성</div>
                  </button>
                  <button
                    onClick={() => setImageMode("wash")}
                    className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                      imageMode === "wash"
                        ? "border-emerald-500 bg-emerald-500/10 text-white"
                        : "border-slate-600 bg-slate-700/30 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    <ImageIcon className="w-6 h-6 mb-2 mx-auto" />
                    <div className="font-semibold">이미지 세탁</div>
                  </button>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4 flex items-start gap-3">
                  <ImageIcon className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-slate-300">
                    {imageMode === "ai"
                      ? "AI를 활용하여 원고에 맞는 고품질 이미지를 자동으로 생성합니다."
                      : "업로드한 이미지를 세탁하여 고유한 이미지로 변환합니다."}
                  </p>
                </div>

                {/* 이미지 세탁 모드: 업로드 영역 및 옵션 */}
                {imageMode === "wash" && (
                  <div className="mt-6 space-y-4">
                    <div
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      className="border-2 border-dashed border-slate-600 rounded-xl p-12 text-center hover:border-emerald-500 transition-colors cursor-pointer"
                    >
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="image-upload"
                      />
                      <label htmlFor="image-upload" className="cursor-pointer">
                        <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                        <p className="text-slate-300 font-medium mb-2">이곳에 이미지를 올려주세요</p>
                        <p className="text-sm text-slate-500">폴더를 선택하거나 이미지를 드래그하세요</p>
                      </label>
                    </div>
                    {uploadedImages.length > 0 && (
                      <div className="text-sm text-slate-400">
                        {uploadedImages.length}개의 이미지가 업로드되었습니다.
                      </div>
                    )}

                    <div className="mt-6">
                      <h3 className="text-lg font-semibold text-white mb-4">사진 세탁 옵션</h3>
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 p-4 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 cursor-pointer">
                          <Checkbox
                            checked={washOptions.transparentOverlay}
                            onCheckedChange={(checked) =>
                              setWashOptions({ ...washOptions, transparentOverlay: !!checked })
                            }
                            className="border-slate-600"
                          />
                          <span className="text-slate-300">반투명 겹치기</span>
                        </label>
                        <label className="flex items-center gap-3 p-4 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 cursor-pointer">
                          <Checkbox
                            checked={washOptions.angleRotation}
                            onCheckedChange={(checked) =>
                              setWashOptions({ ...washOptions, angleRotation: !!checked })
                            }
                            className="border-slate-600"
                          />
                          <span className="text-slate-300">각도 회전(랜덤)</span>
                        </label>
                        <label className="flex items-center gap-3 p-4 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 cursor-pointer">
                          <Checkbox
                            checked={washOptions.frame}
                            onCheckedChange={(checked) =>
                              setWashOptions({ ...washOptions, frame: !!checked })
                            }
                            className="border-slate-600"
                          />
                          <span className="text-slate-300">프레임 씌우기 (랜덤)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 생성 버튼 */}
            <Button
              onClick={handleGenerateContent}
              disabled={isGenerating || !keyword.trim()}
              className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white py-6 text-lg font-semibold shadow-lg shadow-emerald-500/30 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 mr-2" />
                  AI 콘텐츠 생성하기
                </>
              )}
            </Button>
          </div>

          {/* 오른쪽: 생성된 콘텐츠 미리보기 */}
          <div className="col-span-5">
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm h-full sticky top-8">
              <CardContent className="p-6 h-full flex flex-col">
                {isGenerating ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <Loader2 className="w-16 h-16 text-emerald-400 animate-spin mb-4" />
                    <p className="text-slate-400">AI가 콘텐츠를 생성하고 있습니다...</p>
                  </div>
                ) : generatedContent ? (
                  <div className="flex-1 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-4">
                      <PenTool className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-xl font-semibold text-white">생성된 콘텐츠</h3>
                    </div>
                    <div className="prose prose-invert max-w-none">
                      <div className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {generatedContent}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <PenTool className="w-16 h-16 text-slate-600 mb-4" />
                    <h3 className="text-xl font-semibold text-slate-400 mb-2">Your AI-Drafted Content</h3>
                    <p className="text-slate-500">결과가 여기에 표시됩니다.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BlogAIPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    }>
      <BlogAIPageContent />
    </Suspense>
  )
}



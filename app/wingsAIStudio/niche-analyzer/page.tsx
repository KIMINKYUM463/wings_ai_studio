"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Search, 
  ArrowLeft, 
  TrendingUp, 
  Target, 
  BarChart3,
  Lightbulb,
  Sparkles
} from "lucide-react"
import Link from "next/link"

export default function NicheAnalyzerPage() {
  const [keyword, setKeyword] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleAnalyze = async () => {
    if (!keyword.trim()) return
    setIsAnalyzing(true)
    // TODO: 실제 분석 로직 구현
    setTimeout(() => {
      setIsAnalyzing(false)
      alert("기능 준비 중입니다. 곧 출시될 예정입니다!")
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50">
      {/* 배경 장식 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-cyan-200/20 to-blue-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-indigo-200/20 to-purple-200/20 rounded-full blur-3xl" />
      </div>

      {/* 헤더 */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/50 bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/WingsAIStudio" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">메인으로</span>
            </Link>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg">
                <Search className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900">틈새주제 분석기</span>
            </div>
            <div className="w-24" /> {/* 균형을 위한 빈 공간 */}
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* 히어로 섹션 */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-200/50 text-cyan-700 text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            AI 기반 블루오션 분석
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            경쟁이 적은 <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">틈새 주제</span>를 찾아보세요
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            AI가 유튜브 데이터를 분석하여 경쟁은 낮고 수요는 높은 블루오션 주제를 추천해드립니다
          </p>
        </div>

        {/* 검색 카드 */}
        <Card className="max-w-2xl mx-auto mb-12 border-0 shadow-xl bg-white/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-cyan-500" />
              주제 분석하기
            </CardTitle>
            <CardDescription>
              분석하고 싶은 키워드나 카테고리를 입력하세요
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="keyword">키워드 입력</Label>
              <div className="flex gap-2">
                <Input
                  id="keyword"
                  placeholder="예: 건강, 재테크, 요리, IT..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                />
                <Button 
                  onClick={handleAnalyze}
                  disabled={!keyword.trim() || isAnalyzing}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                >
                  {isAnalyzing ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                      분석 중...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      분석하기
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 기능 소개 카드들 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">트렌드 분석</h3>
              <p className="text-sm text-slate-600">
                실시간 검색 트렌드와 성장 가능성을 분석합니다
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">경쟁 분석</h3>
              <p className="text-sm text-slate-600">
                해당 주제의 경쟁 강도와 진입 난이도를 파악합니다
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Lightbulb className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">주제 추천</h3>
              <p className="text-sm text-slate-600">
                AI가 최적의 틈새 주제를 추천해드립니다
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 준비 중 안내 */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
            <Sparkles className="w-5 h-5" />
            <span className="font-medium">이 기능은 현재 개발 중입니다. 곧 출시될 예정입니다!</span>
          </div>
        </div>
      </main>
    </div>
  )
}


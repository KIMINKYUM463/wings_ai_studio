"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Save, Eye, EyeOff } from "lucide-react"
import { useRouter } from "next/navigation"

export default function SettingsPage() {
  const router = useRouter()
  const [youtubeApiKey, setYoutubeApiKey] = useState("")
  const [geminiApiKey, setGeminiApiKey] = useState("")
  const [replicateApiKey, setReplicateApiKey] = useState("")
  const [showYoutubeKey, setShowYoutubeKey] = useState(false)
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [showReplicateKey, setShowReplicateKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // 로컬 스토리지에서 API 키 불러오기
  useEffect(() => {
    const savedYoutubeKey = localStorage.getItem("youmaker_youtube_api_key") || ""
    const savedGeminiKey = localStorage.getItem("youmaker_gemini_api_key") || ""
    const savedReplicateKey = localStorage.getItem("youmaker_replicate_api_key")
    const defaultReplicateKey = "r8_AgOeBCpTw8baE7gXQsErwViD1taChAB19ZHLA"
    
    setYoutubeApiKey(savedYoutubeKey)
    setGeminiApiKey(savedGeminiKey)
    setReplicateApiKey(savedReplicateKey || defaultReplicateKey)
    
    // Replicate API 키가 없으면 기본값으로 저장
    if (!savedReplicateKey) {
      localStorage.setItem("youmaker_replicate_api_key", defaultReplicateKey)
    }
  }, [])

  // API 키 저장
  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)

    try {
      // 로컬 스토리지에 저장
      localStorage.setItem("youmaker_youtube_api_key", youtubeApiKey)
      localStorage.setItem("youmaker_gemini_api_key", geminiApiKey)
      localStorage.setItem("youmaker_replicate_api_key", replicateApiKey)

      // TODO: 필요시 서버에 저장하는 API 호출 추가
      // await fetch("/api/youmaker/settings", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ youtubeApiKey, geminiApiKey }),
      // })

      setSaveMessage({ type: "success", text: "설정이 저장되었습니다." })
      
      // 3초 후 메시지 제거
      setTimeout(() => {
        setSaveMessage(null)
      }, 3000)
    } catch (error) {
      console.error("설정 저장 실패:", error)
      setSaveMessage({ type: "error", text: "설정 저장에 실패했습니다." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push("/youmaker")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            메인으로
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">설정</CardTitle>
              <p className="text-sm text-slate-600 mt-2">
                YouTube Data API Key, Gemini API Key, Replicate API Key를 입력하세요.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* YouTube Data API Key */}
              <div className="space-y-2">
                <Label htmlFor="youtube-api-key" className="text-base font-semibold">
                  YouTube Data API Key
                </Label>
                <p className="text-sm text-slate-600">
                  YouTube 영상 분석을 위해 필요합니다.{" "}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-500 hover:text-orange-600 underline"
                  >
                    Google Cloud Console
                  </a>
                  에서 발급받을 수 있습니다.
                </p>
                <div className="relative">
                  <Input
                    id="youtube-api-key"
                    type={showYoutubeKey ? "text" : "password"}
                    placeholder="YouTube Data API Key를 입력하세요"
                    value={youtubeApiKey}
                    onChange={(e) => setYoutubeApiKey(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowYoutubeKey(!showYoutubeKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  >
                    {showYoutubeKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Gemini API Key */}
              <div className="space-y-2">
                <Label htmlFor="gemini-api-key" className="text-base font-semibold">
                  Gemini API Key
                </Label>
                <p className="text-sm text-slate-600">
                  AI 분석 및 대본 각색을 위해 필요합니다.{" "}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-500 hover:text-orange-600 underline"
                  >
                    Google AI Studio
                  </a>
                  에서 발급받을 수 있습니다.
                </p>
                <div className="relative">
                  <Input
                    id="gemini-api-key"
                    type={showGeminiKey ? "text" : "password"}
                    placeholder="Gemini API Key를 입력하세요"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  >
                    {showGeminiKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Replicate API Key */}
              <div className="space-y-2">
                <Label htmlFor="replicate-api-key" className="text-base font-semibold">
                  Replicate API Key
                </Label>
                <p className="text-sm text-slate-600">
                  나노바나나 AI 썸네일 생성을 위해 필요합니다.{" "}
                  <a
                    href="https://replicate.com/account/api-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-500 hover:text-orange-600 underline"
                  >
                    Replicate
                  </a>
                  에서 발급받을 수 있습니다. (기본값이 설정되어 있습니다)
                </p>
                <div className="relative">
                  <Input
                    id="replicate-api-key"
                    type={showReplicateKey ? "text" : "password"}
                    placeholder="Replicate API Key를 입력하세요"
                    value={replicateApiKey}
                    onChange={(e) => setReplicateApiKey(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowReplicateKey(!showReplicateKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  >
                    {showReplicateKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* 저장 버튼 및 메시지 */}
              <div className="space-y-4">
                {saveMessage && (
                  <div
                    className={`p-4 rounded-lg ${
                      saveMessage.type === "success"
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}
                  >
                    {saveMessage.text}
                  </div>
                )}
                <div className="flex justify-end gap-4">
                  <Button
                    onClick={() => router.push("/youmaker")}
                    variant="outline"
                    size="lg"
                  >
                    취소
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    size="lg"
                    className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                  >
                    {isSaving ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        저장 중...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        저장
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 안내 카드 */}
          <Card className="border-0 shadow-lg bg-blue-50">
            <CardHeader>
              <CardTitle className="text-lg text-blue-900">API 키 발급 안내</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-blue-800">
              <div>
                <h4 className="font-semibold mb-2">YouTube Data API Key 발급 방법:</h4>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Google Cloud Console에 접속합니다.</li>
                  <li>프로젝트를 생성하거나 기존 프로젝트를 선택합니다.</li>
                  <li>API 및 서비스 → 사용자 인증 정보로 이동합니다.</li>
                  <li>"사용자 인증 정보 만들기" → "API 키"를 선택합니다.</li>
                  <li>YouTube Data API v3를 활성화합니다.</li>
                </ol>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Gemini API Key 발급 방법:</h4>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Google AI Studio에 접속합니다.</li>
                  <li>로그인 후 "Get API Key"를 클릭합니다.</li>
                  <li>프로젝트를 선택하거나 새로 생성합니다.</li>
                  <li>생성된 API 키를 복사하여 입력합니다.</li>
                </ol>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Replicate API Key 발급 방법:</h4>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Replicate에 접속합니다.</li>
                  <li>로그인 후 계정 설정으로 이동합니다.</li>
                  <li>"API Tokens" 섹션에서 새 토큰을 생성합니다.</li>
                  <li>생성된 토큰을 복사하여 입력합니다. (기본값이 설정되어 있습니다)</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}


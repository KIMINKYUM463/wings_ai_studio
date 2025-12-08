"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Wand2, Play, Pause, Download, Settings, Mic, Type, Sparkles, CheckCircle, Loader2 } from "lucide-react"

interface AIEditorProps {
  videoId?: string
  script?: string
  onComplete?: (result: any) => void
}

interface SubtitleSegment {
  id: string
  text: string
  startTime: number
  endTime: number
  x: number
  y: number
  fontSize: number
  color: string
  style: string
}

export default function AIEditor({ videoId, script = "", onComplete }: AIEditorProps) {
  const [currentScript, setCurrentScript] = useState(script)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState("")

  // TTS 설정
  const [ttsVoice, setTtsVoice] = useState("ko-KR-Neural2-A")
  const [ttsSpeed, setTtsSpeed] = useState(1.0)
  const [ttsPitch, setTtsPitch] = useState(0)
  const [ttsVolume, setTtsVolume] = useState(0.8)

  // 자막 설정
  const [subtitleStyle, setSubtitleStyle] = useState("modern")
  const [subtitleSize, setSubtitleSize] = useState(24)
  const [subtitleColor, setSubtitleColor] = useState("#ffffff")
  const [subtitlePosition, setSubtitlePosition] = useState("bottom")

  // 편집 설정
  const [autoTransitions, setAutoTransitions] = useState(true)
  const [backgroundMusic, setBackgroundMusic] = useState(true)
  const [visualEffects, setVisualEffects] = useState(true)

  // 결과 데이터
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null)
  const [subtitles, setSubtitles] = useState<SubtitleSegment[]>([])
  const [isPlaying, setIsPlaying] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)

  const voiceOptions = [
    { value: "ko-KR-Neural2-A", label: "한국어 여성 (자연스러운)" },
    { value: "ko-KR-Neural2-B", label: "한국어 남성 (자연스러운)" },
    { value: "ko-KR-Neural2-C", label: "한국어 여성 (활기찬)" },
    { value: "ko-KR-Standard-A", label: "한국어 여성 (표준)" },
    { value: "ko-KR-Standard-B", label: "한국어 남성 (표준)" },
  ]

  const subtitleStyles = [
    { value: "modern", label: "모던" },
    { value: "classic", label: "클래식" },
    { value: "bold", label: "볼드" },
    { value: "elegant", label: "우아한" },
    { value: "playful", label: "재미있는" },
  ]

  const steps = [
    { id: "tts", label: "음성 생성", description: "AI가 대본을 자연스러운 음성으로 변환합니다" },
    { id: "subtitles", label: "자막 생성", description: "음성에 맞춰 정확한 타이밍의 자막을 생성합니다" },
    { id: "sync", label: "영상 동기화", description: "음성과 자막을 영상에 동기화합니다" },
    { id: "effects", label: "효과 적용", description: "전환 효과와 배경음악을 추가합니다" },
    { id: "render", label: "최종 렌더링", description: "모든 요소를 합쳐 최종 영상을 생성합니다" },
  ]

  const handleStartAIEditing = async () => {
    if (!currentScript.trim() || !videoId) {
      alert("대본과 영상이 필요합니다.")
      return
    }

    setIsProcessing(true)
    setProgress(0)

    try {
      console.log("[v0] AI 편집 시작:", { scriptLength: currentScript.length, videoId })

      // 1단계: TTS 음성 생성
      setCurrentStep("음성 생성 중...")
      setProgress(20)

      const ttsResponse = await fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: currentScript,
          voice: ttsVoice,
          speed: ttsSpeed,
          pitch: ttsPitch,
          volume: ttsVolume,
        }),
      })

      if (!ttsResponse.ok) {
        const errorData = await ttsResponse.json()
        console.error("[v0] TTS 응답 오류:", errorData)
        throw new Error(`TTS 생성 실패: ${errorData.error || "Unknown error"}`)
      }

      const ttsData = await ttsResponse.json()
      console.log("[v0] TTS 데이터 수신:", ttsData)
      setTtsAudioUrl(ttsData.audioUrl)

      // 2단계: 자막 생성
      setCurrentStep("자막 생성 중...")
      setProgress(40)

      const subtitleResponse = await fetch("/api/ai/subtitles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: currentScript,
          audioUrl: ttsData.audioUrl,
          style: subtitleStyle,
          fontSize: subtitleSize,
          color: subtitleColor,
          position: subtitlePosition,
        }),
      })

      if (!subtitleResponse.ok) throw new Error("자막 생성 실패")
      const subtitleData = await subtitleResponse.json()
      setSubtitles(subtitleData.subtitles)

      // 3단계: 영상 동기화
      setCurrentStep("영상 동기화 중...")
      setProgress(60)

      const syncResponse = await fetch("/api/ai/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          audioUrl: ttsData.audioUrl,
          subtitles: subtitleData.subtitles,
        }),
      })

      if (!syncResponse.ok) throw new Error("동기화 실패")

      // 4단계: 효과 적용
      setCurrentStep("효과 적용 중...")
      setProgress(80)

      const effectsResponse = await fetch("/api/ai/effects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          autoTransitions,
          backgroundMusic,
          visualEffects,
        }),
      })

      if (!effectsResponse.ok) throw new Error("효과 적용 실패")

      // 5단계: 최종 렌더링
      setCurrentStep("최종 렌더링 중...")
      setProgress(100)

      const renderResponse = await fetch("/api/ai/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          projectConfig: {
            ttsAudioUrl: ttsData.audioUrl,
            subtitles: subtitleData.subtitles,
            effects: {
              autoTransitions,
              backgroundMusic,
              visualEffects,
            },
          },
        }),
      })

      if (!renderResponse.ok) throw new Error("렌더링 실패")
      const renderData = await renderResponse.json()

      setCurrentStep("완료!")
      onComplete?.(renderData)
    } catch (error) {
      console.error("[v0] AI 편집 실패:", error)
      alert(`AI 편집 실패: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const toggleAudioPlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  return (
    <div className="space-y-6">
      {/* AI 편집 헤더 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            AI 자동 편집
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* 대본 입력 */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">편집할 대본</label>
                <Textarea
                  value={currentScript}
                  onChange={(e) => setCurrentScript(e.target.value)}
                  rows={8}
                  placeholder="AI가 편집할 대본을 입력하세요..."
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  글자 수: {currentScript.length}자 (약 {Math.ceil(currentScript.length / 200)}초)
                </p>
              </div>
            </div>

            {/* 진행 상황 */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">편집 진행 상황</label>
                <div className="space-y-3">
                  {steps.map((step, index) => {
                    const isCompleted = progress > (index + 1) * 20
                    const isCurrent = progress >= index * 20 && progress < (index + 1) * 20 && isProcessing

                    return (
                      <div key={step.id} className="flex items-center gap-3">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                            isCompleted
                              ? "bg-green-500 text-white"
                              : isCurrent
                                ? "bg-blue-500 text-white animate-pulse"
                                : "bg-gray-200 text-gray-500"
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : isCurrent ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            index + 1
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${isCurrent ? "text-blue-600" : ""}`}>{step.label}</p>
                          <p className="text-xs text-muted-foreground">{step.description}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {isProcessing && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{currentStep}</span>
                      <span className="text-sm text-muted-foreground">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-center mt-6">
            <Button
              onClick={handleStartAIEditing}
              disabled={!currentScript.trim() || !videoId || isProcessing}
              size="lg"
              className="gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  AI 편집 진행 중...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  AI 자동 편집 시작
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* TTS 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5" />
            음성 생성 설정
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">음성 선택</label>
                <Select value={ttsVoice} onValueChange={setTtsVoice}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {voiceOptions.map((voice) => (
                      <SelectItem key={voice.value} value={voice.value}>
                        {voice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">말하기 속도: {ttsSpeed}x</label>
                <Slider
                  value={[ttsSpeed]}
                  onValueChange={(value) => setTtsSpeed(value[0])}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">음성 높이: {ttsPitch}</label>
                <Slider
                  value={[ttsPitch]}
                  onValueChange={(value) => setTtsPitch(value[0])}
                  min={-20}
                  max={20}
                  step={1}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">볼륨: {Math.round(ttsVolume * 100)}%</label>
                <Slider
                  value={[ttsVolume]}
                  onValueChange={(value) => setTtsVolume(value[0])}
                  min={0}
                  max={1}
                  step={0.1}
                />
              </div>
            </div>
          </div>

          {ttsAudioUrl && (
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" onClick={toggleAudioPlay}>
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  <span className="text-sm font-medium">생성된 음성 미리듣기</span>
                </div>
                <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                  <Download className="w-4 h-4" />
                  다운로드
                </Button>
              </div>
              <audio ref={audioRef} src={ttsAudioUrl} onEnded={() => setIsPlaying(false)} className="hidden" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 자막 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="w-5 h-5" />
            자막 설정
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">자막 스타일</label>
                <Select value={subtitleStyle} onValueChange={setSubtitleStyle}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {subtitleStyles.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        {style.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">글자 크기: {subtitleSize}px</label>
                <Slider
                  value={[subtitleSize]}
                  onValueChange={(value) => setSubtitleSize(value[0])}
                  min={16}
                  max={48}
                  step={2}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">글자 색상</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={subtitleColor}
                    onChange={(e) => setSubtitleColor(e.target.value)}
                    className="w-12 h-8 rounded border"
                  />
                  <span className="text-sm text-muted-foreground">{subtitleColor}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">자막 위치</label>
                <Select value={subtitlePosition} onValueChange={setSubtitlePosition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">상단</SelectItem>
                    <SelectItem value="center">중앙</SelectItem>
                    <SelectItem value="bottom">하단</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {subtitles.length > 0 && (
            <div className="mt-6">
              <label className="text-sm font-medium mb-2 block">생성된 자막 미리보기</label>
              <div className="max-h-40 overflow-y-auto bg-muted/50 rounded-lg p-4 space-y-2">
                {subtitles.map((subtitle, index) => (
                  <div key={subtitle.id} className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground min-w-16">{Math.floor(subtitle.startTime)}s</span>
                    <span className="flex-1">{subtitle.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 편집 효과 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            편집 효과 설정
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">자동 전환 효과</p>
                <p className="text-sm text-muted-foreground">장면 전환 시 자동으로 효과 적용</p>
              </div>
              <Button
                variant={autoTransitions ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoTransitions(!autoTransitions)}
              >
                {autoTransitions ? "ON" : "OFF"}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">배경음악</p>
                <p className="text-sm text-muted-foreground">적절한 배경음악 자동 추가</p>
              </div>
              <Button
                variant={backgroundMusic ? "default" : "outline"}
                size="sm"
                onClick={() => setBackgroundMusic(!backgroundMusic)}
              >
                {backgroundMusic ? "ON" : "OFF"}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">시각 효과</p>
                <p className="text-sm text-muted-foreground">텍스트 애니메이션 및 강조 효과</p>
              </div>
              <Button
                variant={visualEffects ? "default" : "outline"}
                size="sm"
                onClick={() => setVisualEffects(!visualEffects)}
              >
                {visualEffects ? "ON" : "OFF"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

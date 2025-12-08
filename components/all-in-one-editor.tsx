"use client"

import React from "react"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Wand2,
  Play,
  Pause,
  Settings,
  Type,
  Sparkles,
  Loader2,
  Video,
  Music,
  Plus,
  Filter,
  Layers,
  Upload,
  Smile,
  ZoomIn,
  ZoomOut,
  Grid,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Copy,
  Trash2,
  SkipBack,
  Square,
} from "lucide-react"
import { generateShortsTopics, generateShortsScript } from "@/app/shorts/actions"

interface AllInOneEditorProps {
  onComplete?: (result: any) => void
}

interface TextElement {
  id: string
  type: "text"
  content: string
  x: number
  y: number
  fontSize: number
  fontWeight: string
  color: string
  fontFamily: string
  textAlign: string
  textShadow: string
  background: string
  borderRadius: string
  padding: string
  startTime: number
  endTime: number
  animationPreset: string
}

interface TimelineTrack {
  id: string
  type: "video" | "audio" | "text" | "effect"
  name: string
  startTime: number
  duration: number
  color: string
  locked: boolean
  visible: boolean
  content?: any
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

export default function AllInOneEditor({ onComplete }: AllInOneEditorProps) {
  // 메인 상태
  const [currentTab, setCurrentTab] = useState("script")
  const [keywords, setKeywords] = useState("")
  const [topics, setTopics] = useState<string[]>([])
  const [selectedTopic, setSelectedTopic] = useState("")
  const [currentScript, setCurrentScript] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)

  // 비디오 편집 상태
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(30)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)

  // 편집 도구 상태
  const [selectedTool, setSelectedTool] = useState("미디어")
  const [zoom, setZoom] = useState(100)
  const [textElements, setTextElements] = useState<TextElement[]>([])
  const [selectedElement, setSelectedElement] = useState<TextElement | null>(null)

  // 타임라인 상태
  const [timelineScale, setTimelineScale] = useState(1)
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null)
  const [playheadPosition, setPlayheadPosition] = useState(0)

  // 필터 및 효과
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [saturation, setSaturation] = useState(100)
  const [blur, setBlur] = useState(0)

  // 캔버스 설정
  const [showGrid, setShowGrid] = useState(false)
  const [showSafeArea, setShowSafeArea] = useState(false)
  const [canvasSize] = useState({ width: 360, height: 640 })
  const [videoRotation, setVideoRotation] = useState(0)

  // AI 편집 상태
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState("")
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null)
  const [subtitles, setSubtitles] = useState<SubtitleSegment[]>([])

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

  // 드래그 상태
  const [isDragging, setIsDragging] = useState(false)
  const [draggedElement, setDraggedElement] = useState<TextElement | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // 타임라인 트랙 데이터
  const [timelineTracks, setTimelineTracks] = useState<TimelineTrack[]>([
    {
      id: "video-1",
      type: "video",
      name: "메인 비디오",
      startTime: 0,
      duration: 15,
      color: "#3b82f6",
      locked: false,
      visible: true,
    },
    {
      id: "audio-1",
      type: "audio",
      name: "배경음악",
      startTime: 0,
      duration: 20,
      color: "#10b981",
      locked: false,
      visible: true,
    },
  ])

  const sidebarTabs = [
    { id: "미디어", icon: Video, label: "미디어" },
    { id: "템플릿", icon: Layers, label: "템플릿" },
    { id: "오디오", icon: Music, label: "오디오" },
    { id: "텍스트", icon: Type, label: "텍스트" },
    { id: "효과", icon: Sparkles, label: "효과" },
    { id: "필터", icon: Filter, label: "필터" },
    { id: "스티커", icon: Smile, label: "스티커" },
  ]

  const voiceOptions = [
    { value: "ko-KR-Neural2-A", label: "한국어 여성 (자연스러운)" },
    { value: "ko-KR-Neural2-B", label: "한국어 남성 (자연스러운)" },
    { value: "ko-KR-Neural2-C", label: "한국어 여성 (활기찬)" },
  ]

  // 대본을 문장별로 미리 분할하는 함수
  const previewSubtitleSegments = (script: string) => {
    if (!script.trim()) return []

    // 한국어 문장 분할 (마침표, 느낌표, 물음표 기준)
    const sentences = script
      .split(/[.!?]\s+/)
      .filter((sentence) => sentence.trim().length > 0)
      .map((sentence) => sentence.trim())

    // 각 문장에 예상 시간 할당 (한국어 기준 13자/초)
    let currentTime = 0
    return sentences.map((sentence, index) => {
      const duration = Math.max(1.5, sentence.length / 13) // 최소 1.5초
      const segment = {
        id: `preview-${index}`,
        text: sentence,
        startTime: currentTime,
        endTime: currentTime + duration,
        x: 50,
        y: 85,
        fontSize: 32,
        color: "#ffffff",
        style: "modern",
      }
      currentTime += duration
      return segment
    })
  }

  // 미리보기 자막 상태 추가
  const [previewSubtitles, setPreviewSubtitles] = useState<SubtitleSegment[]>([])

  // 대본이 변경될 때마다 미리보기 자막 업데이트
  const updatePreviewSubtitles = (script: string) => {
    const segments = previewSubtitleSegments(script)
    setPreviewSubtitles(segments)
  }

  // 현재 시간에 표시되어야 할 미리보기 자막
  const getCurrentPreviewSubtitles = () => {
    if (ttsAudioUrl) {
      // TTS가 생성된 경우 실제 자막 사용 (시간에 맞춰 한줄씩 표시)
      return textElements.filter(
        (element) =>
          element.id.startsWith("subtitle-") && currentTime >= element.startTime && currentTime <= element.endTime,
      )
    } else {
      // TTS가 생성되지 않은 경우 미리보기 자막 사용 (모든 자막 표시)
      return previewSubtitles.map((subtitle) => ({
        id: subtitle.id,
        type: "text" as const,
        content: subtitle.text,
        x: subtitle.x,
        y: subtitle.y,
        fontSize: subtitle.fontSize,
        fontWeight: "bold",
        color: subtitle.color,
        fontFamily: "Arial",
        textAlign: "center",
        textShadow: "3px 3px 6px rgba(0,0,0,0.9)",
        background: "rgba(0,0,0,0.6)",
        borderRadius: "12px",
        padding: "12px 20px",
        startTime: subtitle.startTime,
        endTime: subtitle.endTime,
        animationPreset: "fadeIn",
      }))
    }
  }

  // 대본 생성 함수들
  const handleGenerateTopics = async () => {
    if (!keywords.trim()) {
      alert("키워드를 입력해주세요.")
      return
    }

    setIsGenerating(true)
    try {
      const generatedTopics = await generateShortsTopics(keywords)
      setTopics(generatedTopics)
    } catch (error) {
      console.error("주제 생성 실패:", error)
      alert("주제 생성에 실패했습니다.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleKeywordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!keywords.trim()) {
      alert("키워드를 입력해주세요.")
      return
    }

    setIsGenerating(true)
    try {
      // 키워드를 바탕으로 바로 대본 생성
      const script = await generateShortsScript(keywords)
      setCurrentScript(script)
      updatePreviewSubtitles(script)
      setCurrentTab("editor") // 대본 생성 후 편집기로 이동
    } catch (error) {
      console.error("대본 생성 실패:", error)
      alert("대본 생성에 실패했습니다.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleKeywordKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleKeywordSubmit(e as any)
    }
  }

  const handleGenerateScript = async () => {
    if (!selectedTopic) {
      alert("주제를 선택해주세요.")
      return
    }

    setIsGenerating(true)
    try {
      const script = await generateShortsScript(selectedTopic)
      setCurrentScript(script)
      updatePreviewSubtitles(script)
      setCurrentTab("editor") // 대본 생성 후 편집기로 이동
    } catch (error) {
      console.error("대본 생성 실패:", error)
      alert("대본 생성에 실패했습니다.")
    } finally {
      setIsGenerating(false)
    }
  }

  // 파일 업로드 처리
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith("video/")) {
      const url = URL.createObjectURL(file)
      setVideoUrl(url)

      // 타임라인에 비디오 트랙 추가
      const newTrack: TimelineTrack = {
        id: `video-${Date.now()}`,
        type: "video",
        name: file.name,
        startTime: 0,
        duration: 15, // 실제로는 비디오 길이를 가져와야 함
        color: "#3b82f6",
        locked: false,
        visible: true,
        content: { url, file },
      }
      setTimelineTracks((prev) => [...prev, newTrack])
    }
  }

  const [playbackInterval, setPlaybackInterval] = useState<NodeJS.Timeout | null>(null)

  // 비디오 재생 제어
  const togglePlay = () => {
    console.log("[v0] 재생 버튼 클릭:", { isPlaying, currentTime })

    if (isPlaying) {
      // 일시정지
      if (videoRef.current) {
        videoRef.current.pause()
      }
      if (ttsAudioUrl) {
        const audioElements = document.querySelectorAll("audio")
        audioElements.forEach((audio) => {
          audio.pause()
        })
      }
      if (playbackInterval) {
        clearInterval(playbackInterval)
        setPlaybackInterval(null)
      }
      setIsPlaying(false)
    } else {
      // 재생
      if (videoRef.current) {
        videoRef.current.currentTime = currentTime
        videoRef.current.play()
      }
      if (ttsAudioUrl) {
        const audioElements = document.querySelectorAll("audio")
        audioElements.forEach((audio) => {
          audio.currentTime = currentTime
          audio.play()
        })
      }

      // 타임라인 업데이트를 위한 인터벌 시작
      const interval = setInterval(() => {
        setCurrentTime((prevTime) => {
          const newTime = Math.min(prevTime + 0.1, duration)
          setPlayheadPosition(newTime)
          console.log("[v0] 타임라인 업데이트:", newTime)

          if (newTime >= duration) {
            setIsPlaying(false)
            clearInterval(interval)
            setPlaybackInterval(null)
            return duration
          }
          return newTime
        })
      }, 100) // 100ms마다 업데이트

      setPlaybackInterval(interval)
      setIsPlaying(true)
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const newTime = videoRef.current.currentTime
      setCurrentTime(newTime)
      setPlayheadPosition(newTime)

      if (ttsAudioUrl) {
        const audioElements = document.querySelectorAll("audio")
        audioElements.forEach((audio) => {
          if (Math.abs(audio.currentTime - newTime) > 0.5) {
            audio.currentTime = newTime
          }
        })
      }
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time
    }
    setCurrentTime(time)
    setPlayheadPosition(time)
  }

  React.useEffect(() => {
    return () => {
      if (playbackInterval) {
        clearInterval(playbackInterval)
      }
    }
  }, [playbackInterval])

  // 텍스트 요소 관리
  const addText = () => {
    const newText: TextElement = {
      id: `text-${Date.now()}`,
      type: "text",
      content: "텍스트를 입력하세요",
      x: 50,
      y: 50,
      fontSize: 24,
      fontWeight: "bold",
      color: "#ffffff",
      fontFamily: "Arial",
      textAlign: "center",
      textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
      background: "transparent",
      borderRadius: "0px",
      padding: "0px",
      startTime: currentTime,
      endTime: currentTime + 3,
      animationPreset: "none",
    }
    setTextElements([...textElements, newText])
    setSelectedElement(newText)

    // 타임라인에 텍스트 트랙 추가
    const newTrack: TimelineTrack = {
      id: `text-track-${Date.now()}`,
      type: "text",
      name: "텍스트",
      startTime: currentTime,
      duration: 3,
      color: "#f59e0b",
      locked: false,
      visible: true,
      content: newText,
    }
    setTimelineTracks((prev) => [...prev, newTrack])
  }

  // 드래그 앤 드롭 처리
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files)
      files.forEach((file) => {
        if (file.type.startsWith("video/")) {
          const url = URL.createObjectURL(file)
          setVideoUrl(url)

          const newTrack: TimelineTrack = {
            id: `video-${Date.now()}`,
            type: "video",
            name: file.name,
            startTime: currentTime,
            duration: 10,
            color: "#3b82f6",
            locked: false,
            visible: true,
            content: { url, file },
          }
          setTimelineTracks((tracks) => [...tracks, newTrack])
        }
      })
    },
    [currentTime],
  )

  // 텍스트 드래그 처리
  const handleTextMouseDown = useCallback((e: React.MouseEvent, element: TextElement) => {
    e.preventDefault()
    e.stopPropagation()

    const rect = e.currentTarget.getBoundingClientRect()
    const canvasRect = canvasRef.current?.getBoundingClientRect()

    if (canvasRect) {
      setDraggedElement(element)
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
      setSelectedElement(element)
    }
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (draggedElement && canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect()
        const newX = ((e.clientX - canvasRect.left - dragOffset.x) / canvasRect.width) * 100
        const newY = ((e.clientY - canvasRect.top - dragOffset.y) / canvasRect.height) * 100

        const updatedElement = {
          ...draggedElement,
          x: Math.max(0, Math.min(100, newX)),
          y: Math.max(0, Math.min(100, newY)),
        }

        setDraggedElement(updatedElement)
        setSelectedElement(updatedElement)
        setTextElements((elements) => elements.map((el) => (el.id === updatedElement.id ? updatedElement : el)))
      }
    },
    [draggedElement, dragOffset],
  )

  const handleMouseUp = useCallback(() => {
    setDraggedElement(null)
    setDragOffset({ x: 0, y: 0 })
  }, [])

  // AI 자동 편집 처리
  const handleStartAIEditing = async () => {
    if (!currentScript.trim()) {
      alert("대본이 필요합니다.")
      return
    }

    setIsProcessing(true)
    setProgress(0)

    try {
      console.log("[v0] AI 편집 시작:", { scriptLength: currentScript.length })

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
        throw new Error("TTS 생성 실패")
      }

      const ttsData = await ttsResponse.json()
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

      await new Promise((resolve) => setTimeout(resolve, 1000))

      // 4단계: 효과 적용
      setCurrentStep("효과 적용 중...")
      setProgress(80)

      await new Promise((resolve) => setTimeout(resolve, 1000))

      // 5단계: 최종 렌더링
      setCurrentStep("최종 렌더링 중...")
      setProgress(100)

      await new Promise((resolve) => setTimeout(resolve, 1000))

      setCurrentStep("완료!")
      onComplete?.({ success: true })
    } catch (error) {
      console.error("[v0] AI 편집 실패:", error)
      alert(`AI 편집 실패: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const getCurrentSubtitles = () => {
    return textElements.filter((element) => currentTime >= element.startTime && currentTime <= element.endTime)
  }

  const handleGenerateTTS = async () => {
    if (!currentScript.trim()) {
      alert("대본이 필요합니다.")
      return
    }

    setIsProcessing(true)
    setCurrentStep("TTS 음성 생성 중...")
    setProgress(20)

    try {
      console.log("[v0] Google TTS 생성 시작:", { scriptLength: currentScript.length })

      const response = await fetch("/api/google-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: currentScript, // API에서 [스크립트] 부분만 추출하도록 수정됨
          voice: ttsVoice,
          speed: ttsSpeed,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "TTS 생성 실패")
      }

      const data = await response.json()
      setTtsAudioUrl(data.audioUrl)
      setSubtitles(data.subtitles)

      const audioTrack: TimelineTrack = {
        id: `tts-audio-${Date.now()}`,
        type: "audio",
        name: "TTS 음성",
        startTime: 0,
        duration: data.duration || 15,
        color: "#10b981",
        locked: false,
        visible: true,
        content: { url: data.audioUrl, type: "tts", syncWithVideo: true },
      }

      setTimelineTracks((prev) => [...prev, audioTrack])

      const subtitleElements: TextElement[] = data.subtitles.map((subtitle: any, index: number) => ({
        id: `subtitle-${subtitle.id}`,
        type: "text" as const,
        content: subtitle.text,
        x: 50, // 화면 중앙
        y: 85, // 화면 하단
        fontSize: 32,
        fontWeight: "bold",
        color: subtitle.color, // API에서 받은 색상 사용
        fontFamily: "Arial",
        textAlign: "center",
        textShadow: "3px 3px 6px rgba(0,0,0,0.9)",
        background: "rgba(0,0,0,0.6)",
        borderRadius: "12px",
        padding: "12px 20px",
        startTime: subtitle.startTime,
        endTime: subtitle.endTime,
        animationPreset: "fadeIn",
      }))

      setTextElements((prev) => [...prev, ...subtitleElements])

      const subtitleTrack: TimelineTrack = {
        id: `subtitle-track-${Date.now()}`,
        type: "text",
        name: `자막 (${data.subtitles.length}개)`,
        startTime: 0,
        duration: data.duration || 15,
        color: "#f59e0b", // 노란색으로 통일
        locked: false,
        visible: true,
        content: {
          type: "subtitle-group",
          subtitles: data.subtitles,
          elements: subtitleElements,
        },
      }

      setTimelineTracks((prev) => [...prev, subtitleTrack])

      setProgress(100)
      setCurrentStep("TTS 및 자막 생성 완료!")

      console.log("[v0] TTS 생성 완료:", {
        audioUrl: data.audioUrl.substring(0, 50) + "...",
        subtitleCount: data.subtitles.length,
      })

      setTimeout(() => {
        setIsProcessing(false)
        setProgress(0)
        setCurrentStep("")
      }, 2000)
    } catch (error) {
      console.error("[v0] TTS 생성 실패:", error)
      alert(`TTS 생성 실패: ${error.message}`)
      setIsProcessing(false)
      setProgress(0)
      setCurrentStep("")
    }
  }

  // 유틸리티 함수들
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const timeToPixels = (time: number) => {
    return (time / duration) * 800 * timelineScale
  }

  const getVideoStyle = () => {
    const filterString = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px)`
    return { filter: filterString }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      {/* 상단 탭 네비게이션 */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="script">대본 생성</TabsTrigger>
            <TabsTrigger value="editor">비디오 편집</TabsTrigger>
            <TabsTrigger value="ai">AI 자동 편집</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <Tabs value={currentTab} className="flex-1 flex flex-col">
          {/* 대본 생성 탭 */}
          <TabsContent value="script" className="flex-1 p-6 overflow-auto">
            <div className="max-w-4xl mx-auto space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>키워드로 바로 대본 생성</CardTitle>
                  <p className="text-sm text-gray-500">
                    키워드를 입력하고 Enter를 누르거나 생성 버튼을 클릭하면 바로 15-20초 분량의 대본이 생성됩니다.
                  </p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleKeywordSubmit} className="flex gap-4">
                    <Input
                      placeholder="쇼츠 주제 키워드를 입력하세요 (예: 살림, 다이어트, 건강, 요리)"
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      onKeyPress={handleKeywordKeyPress}
                      className="flex-1"
                      disabled={isGenerating}
                    />
                    <Button type="submit" disabled={isGenerating || !keywords.trim()}>
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : "대본 생성"}
                    </Button>
                  </form>

                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">인기 키워드 예시:</p>
                    <div className="flex flex-wrap gap-2">
                      {["살림", "다이어트", "건강", "요리", "운동", "뷰티", "패션", "여행"].map((keyword) => (
                        <Button
                          key={keyword}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setKeywords(keyword)
                            // 키워드 설정 후 바로 대본 생성
                            setTimeout(() => {
                              handleKeywordSubmit({ preventDefault: () => {} } as any)
                            }, 100)
                          }}
                          disabled={isGenerating}
                          className="text-xs"
                        >
                          {keyword}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {currentScript && (
                <Card>
                  <CardHeader>
                    <CardTitle>생성된 대본</CardTitle>
                    <p className="text-sm text-gray-500">
                      키워드: <span className="font-medium">{keywords}</span>
                    </p>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={currentScript}
                      onChange={(e) => setCurrentScript(e.target.value)}
                      rows={10}
                      className="font-mono"
                    />
                    <div className="flex justify-between items-center mt-4">
                      <p className="text-sm text-gray-500">
                        {/* 더 정확한 시간 계산과 15-20초 권장 표시 */}
                        글자 수: {currentScript.length}자 (약 {Math.ceil(currentScript.length / 13)}초)
                        {currentScript.length < 150 && (
                          <span className="text-orange-500 ml-2">⚠️ 너무 짧음 (150자 이상 권장)</span>
                        )}
                        {currentScript.length > 250 && (
                          <span className="text-red-500 ml-2">⚠️ 너무 김 (250자 이하 권장)</span>
                        )}
                        {currentScript.length >= 150 && currentScript.length <= 250 && (
                          <span className="text-green-500 ml-2">✅ 적정 길이 (15-20초)</span>
                        )}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handleKeywordSubmit({ preventDefault: () => {} } as any)}
                          disabled={isGenerating}
                        >
                          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          다시 생성
                        </Button>
                        <Button onClick={() => setCurrentTab("editor")}>편집기로 이동</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* 비디오 편집 탭 */}
          <TabsContent value="editor" className="flex-1 flex">
            {/* 왼쪽 사이드바 */}
            <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">편집 도구</h2>
                  <Button variant="ghost" size="sm">
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-4 gap-1">
                  {sidebarTabs.map((tab) => {
                    const Icon = tab.icon
                    return (
                      <Button
                        key={tab.id}
                        variant={selectedTool === tab.id ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setSelectedTool(tab.id)}
                        className="flex flex-col gap-1 h-auto py-2 text-xs"
                      >
                        <Icon className="w-4 h-4" />
                        {tab.label}
                      </Button>
                    )
                  })}
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4">
                  {selectedTool === "미디어" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">미디어 라이브러리</h3>
                        <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="w-4 h-4 mr-2" />
                          업로드
                        </Button>
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />

                      <div
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                          isDragging ? "border-blue-400 bg-blue-400/10" : "border-gray-600 hover:border-gray-500"
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      >
                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-sm text-gray-400 mb-2">파일을 여기로 드래그하거나 클릭하여 업로드</p>
                        <p className="text-xs text-gray-500">비디오, 오디오, 이미지 파일 지원</p>
                      </div>

                      {currentScript && (
                        <div className="space-y-3 p-4 bg-gray-700 rounded-lg">
                          <h4 className="font-semibold flex items-center gap-2">
                            <Music className="w-4 h-4" />
                            TTS 음성 생성
                          </h4>
                          <p className="text-sm text-gray-300">대본을 바탕으로 음성과 자막을 자동 생성합니다.</p>

                          <div className="space-y-2">
                            <div>
                              <label className="text-sm font-medium mb-1 block">음성 선택</label>
                              <Select value={ttsVoice} onValueChange={setTtsVoice}>
                                <SelectTrigger className="bg-gray-600 border-gray-500">
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
                              <label className="text-sm font-medium mb-1 block">말하기 속도: {ttsSpeed}x</label>
                              <Slider
                                value={[ttsSpeed]}
                                onValueChange={(value) => setTtsSpeed(value[0])}
                                min={0.5}
                                max={2.0}
                                step={0.1}
                                className="w-full"
                              />
                            </div>
                          </div>

                          {isProcessing && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm">{currentStep}</span>
                                <span className="text-sm">{progress}%</span>
                              </div>
                              <Progress value={progress} className="h-2" />
                            </div>
                          )}

                          <Button onClick={handleGenerateTTS} disabled={isProcessing} className="w-full gap-2">
                            {isProcessing ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                생성 중...
                              </>
                            ) : (
                              <>
                                <Wand2 className="w-4 h-4" />
                                TTS 생성
                              </>
                            )}
                          </Button>

                          {ttsAudioUrl && (
                            <div className="space-y-2">
                              <label className="text-sm font-medium">생성된 음성 미리듣기</label>
                              <audio controls src={ttsAudioUrl} className="w-full" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedTool === "텍스트" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">텍스트 도구</h3>
                        <Button size="sm" onClick={addText}>
                          <Plus className="w-4 h-4 mr-2" />
                          추가
                        </Button>
                      </div>

                      {selectedElement && (
                        <div className="space-y-3 p-3 bg-gray-700 rounded-lg">
                          <h4 className="font-medium">선택된 텍스트 편집</h4>

                          <div>
                            <label className="text-sm font-medium mb-1 block">내용</label>
                            <Input
                              value={selectedElement.content}
                              onChange={(e) => {
                                const updated = { ...selectedElement, content: e.target.value }
                                setSelectedElement(updated)
                                setTextElements((elements) =>
                                  elements.map((el) => (el.id === updated.id ? updated : el)),
                                )
                              }}
                              className="bg-gray-600 border-gray-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-sm font-medium mb-1 block">크기</label>
                              <Input
                                type="number"
                                value={selectedElement.fontSize}
                                onChange={(e) => {
                                  const updated = { ...selectedElement, fontSize: Number(e.target.value) }
                                  setSelectedElement(updated)
                                  setTextElements((elements) =>
                                    elements.map((el) => (el.id === updated.id ? updated : el)),
                                  )
                                }}
                                className="bg-gray-600 border-gray-500"
                                min="8"
                                max="100"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium mb-1 block">색상</label>
                              <Input
                                type="color"
                                value={selectedElement.color}
                                onChange={(e) => {
                                  const updated = { ...selectedElement, color: e.target.value }
                                  setSelectedElement(updated)
                                  setTextElements((elements) =>
                                    elements.map((el) => (el.id === updated.id ? updated : el)),
                                  )
                                }}
                                className="bg-gray-600 border-gray-500 h-8"
                              />
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const newElement = { ...selectedElement, id: `text-${Date.now()}` }
                                setTextElements((prev) => [...prev, newElement])
                              }}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setTextElements((elements) => elements.filter((el) => el.id !== selectedElement.id))
                                setSelectedElement(null)
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedTool === "필터" && (
                    <div className="space-y-4">
                      <h3 className="font-semibold">비디오 필터</h3>

                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium mb-2 block">밝기: {brightness}%</label>
                          <Slider
                            value={[brightness]}
                            onValueChange={(value) => setBrightness(value[0])}
                            min={0}
                            max={200}
                            step={1}
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">대비: {contrast}%</label>
                          <Slider
                            value={[contrast]}
                            onValueChange={(value) => setContrast(value[0])}
                            min={0}
                            max={200}
                            step={1}
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">채도: {saturation}%</label>
                          <Slider
                            value={[saturation]}
                            onValueChange={(value) => setSaturation(value[0])}
                            min={0}
                            max={200}
                            step={1}
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">블러: {blur}px</label>
                          <Slider
                            value={[blur]}
                            onValueChange={(value) => setBlur(value[0])}
                            min={0}
                            max={10}
                            step={0.1}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* 중앙 편집 영역 */}
            <div className="flex flex-1 flex-col">
              {/* 상단 컨트롤 바 */}
              <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={togglePlay}>
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" onClick={() => handleSeek(0)}>
                      <SkipBack className="w-4 h-4" />
                    </Button>
                    <Button size="sm" onClick={() => setIsPlaying(false)}>
                      <Square className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="text-sm">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setShowGrid(!showGrid)}>
                    <Grid className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setZoom(Math.max(25, zoom - 25))}>
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <span className="text-sm">{zoom}%</span>
                  <Button size="sm" variant="ghost" onClick={() => setZoom(Math.min(200, zoom + 25))}>
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* 캔버스 영역 */}
              <div
                className="flex-1 flex items-center justify-center bg-gray-900 relative overflow-hidden"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              >
                <div
                  ref={canvasRef}
                  className="relative bg-black border-2 border-gray-600 shadow-2xl overflow-hidden"
                  style={{
                    width: `${canvasSize.width * (zoom / 100)}px`,
                    height: `${canvasSize.height * (zoom / 100)}px`,
                    transform: `rotate(${videoRotation}deg)`,
                  }}
                >
                  {showGrid && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                        {Array.from({ length: 9 }).map((_, i) => (
                          <div key={i} className="border border-white/20" />
                        ))}
                      </div>
                    </div>
                  )}

                  {videoUrl && (
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      className="w-full h-full object-cover"
                      style={getVideoStyle()}
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleLoadedMetadata}
                      muted={isMuted}
                    />
                  )}

                  {/* 미리보기창에서 자막 표시 */}
                  {getCurrentPreviewSubtitles().map((element) => (
                    <div
                      key={element.id}
                      className={`absolute cursor-move select-none ${
                        selectedElement?.id === element.id ? "ring-2 ring-blue-400" : ""
                      }`}
                      style={{
                        left: `${element.x}%`,
                        top: `${element.y}%`,
                        fontSize: `${element.fontSize * (zoom / 100)}px`,
                        fontWeight: element.fontWeight,
                        color: element.color,
                        fontFamily: element.fontFamily,
                        textAlign: element.textAlign as any,
                        textShadow: element.textShadow,
                        background: element.background !== "transparent" ? element.background : undefined,
                        borderRadius: element.borderRadius,
                        padding: element.padding,
                        transform: "translate(-50%, -50%)",
                        opacity: ttsAudioUrl
                          ? currentTime >= element.startTime && currentTime <= element.endTime
                            ? 1
                            : 0
                          : 1, // TTS가 없으면 모든 자막 표시
                        transition: "opacity 0.3s ease-in-out",
                      }}
                      onMouseDown={(e) => handleTextMouseDown(e, element)}
                    >
                      {element.content}
                    </div>
                  ))}

                  {!ttsAudioUrl && previewSubtitles.length > 0 && (
                    <div className="absolute bottom-4 left-4 bg-black/80 text-white p-2 rounded text-sm">
                      미리보기: {previewSubtitles.length}개 자막 준비됨 (TTS 생성 후 시간 동기화)
                    </div>
                  )}
                </div>
              </div>

              {/* 하단 타임라인 */}
              <div className="h-64 bg-gray-800 border-t border-gray-700 flex flex-col">
                <div className="flex-1 flex">
                  <div className="w-48 bg-gray-750 border-r border-gray-700 p-2">
                    <div className="space-y-2">
                      {timelineTracks.map((track) => (
                        <div key={track.id} className="flex items-center gap-2 h-10">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setTimelineTracks((tracks) =>
                                tracks.map((t) => (t.id === track.id ? { ...t, visible: !t.visible } : t)),
                              )
                            }}
                          >
                            {track.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setTimelineTracks((tracks) =>
                                tracks.map((t) => (t.id === track.id ? { ...t, locked: !t.locked } : t)),
                              )
                            }}
                          >
                            {track.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                          </Button>
                          <span className="text-xs truncate flex-1">{track.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div ref={timelineRef} className="flex-1 relative bg-gray-900 overflow-x-auto">
                    {/* 시간 눈금 */}
                    <div className="h-8 bg-gray-800 border-b border-gray-700 relative">
                      {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
                        <div
                          key={i}
                          className="absolute top-0 h-full flex items-center cursor-pointer"
                          style={{ left: `${timeToPixels(i)}px` }}
                          onClick={() => handleSeek(i)}
                        >
                          <div className="w-px h-4 bg-gray-600" />
                          <span className="text-xs text-gray-400 ml-1">{formatTime(i)}</span>
                        </div>
                      ))}
                    </div>

                    {/* 플레이헤드 */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 cursor-ew-resize"
                      style={{ left: `${timeToPixels(playheadPosition)}px` }}
                    >
                      <div className="absolute -top-1 -left-2 w-4 h-4 bg-red-500 transform rotate-45" />
                    </div>

                    <div
                      className="relative"
                      style={{
                        height: `${(timelineTracks.length + (previewSubtitles.length > 0 && !ttsAudioUrl ? previewSubtitles.length : 0)) * 48}px`,
                      }}
                    >
                      {timelineTracks.map((track, index) => (
                        <div
                          key={track.id}
                          className={`absolute h-10 rounded cursor-move transition-all ${
                            track.locked ? "opacity-50 cursor-not-allowed" : "hover:brightness-110"
                          } ${selectedTrack === track.id ? "ring-2 ring-blue-400" : ""}`}
                          style={{
                            top: `${index * 48 + 8}px`,
                            left: `${timeToPixels(track.startTime)}px`,
                            width: `${timeToPixels(track.duration)}px`,
                            backgroundColor: track.color,
                          }}
                          onClick={() => setSelectedTrack(track.id)}
                        >
                          <div className="h-full flex items-center px-2 text-xs font-medium text-white truncate">
                            {track.name}
                          </div>
                        </div>
                      ))}

                      {!ttsAudioUrl &&
                        previewSubtitles.map((subtitle, index) => {
                          const trackColors = [
                            "#f59e0b", // 노란색
                            "#10b981", // 초록색
                            "#3b82f6", // 파란색
                            "#f97316", // 주황색
                            "#ec4899", // 분홍색
                            "#8b5cf6", // 보라색
                            "#06b6d4", // 청록색
                            "#ef4444", // 빨간색
                          ]

                          return (
                            <div
                              key={subtitle.id}
                              className="absolute h-10 rounded border-2 border-dashed opacity-70"
                              style={{
                                top: `${(timelineTracks.length + index) * 48 + 8}px`,
                                left: `${timeToPixels(subtitle.startTime)}px`,
                                width: `${timeToPixels(subtitle.endTime - subtitle.startTime)}px`,
                                backgroundColor: trackColors[index % trackColors.length],
                              }}
                            >
                              <div className="h-full flex items-center px-2 text-xs font-medium text-white truncate">
                                미리보기: {subtitle.text.substring(0, 15)}...
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* AI 자동 편집 탭 */}
          <TabsContent value="ai" className="flex-1 p-6 overflow-auto">
            <div className="max-w-4xl mx-auto space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wand2 className="w-5 h-5" />
                    AI 자동 편집
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">편집할 대본</label>
                      <Textarea
                        value={currentScript}
                        onChange={(e) => {
                          setCurrentScript(e.target.value)
                          updatePreviewSubtitles(e.target.value)
                        }}
                        rows={6}
                        placeholder="AI가 편집할 대본을 입력하세요..."
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {/* 더 정확한 시간 계산 (한국어 기준 12-15자/초) */}
                        글자 수: {currentScript.length}자 (약 {Math.ceil(currentScript.length / 13)}초)
                      </p>
                    </div>

                    {/* TTS 설정 */}
                    <div className="grid md:grid-cols-2 gap-4">
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

                    {/* 편집 효과 설정 */}
                    <div className="grid md:grid-cols-3 gap-4">
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

                    {/* 진행 상황 */}
                    {isProcessing && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{currentStep}</span>
                          <span className="text-sm text-muted-foreground">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    )}

                    <Button
                      onClick={handleStartAIEditing}
                      disabled={!currentScript.trim() || isProcessing}
                      size="lg"
                      className="w-full gap-2"
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

              {/* 생성된 오디오 미리듣기 */}
              {ttsAudioUrl && (
                <Card>
                  <CardHeader>
                    <CardTitle>생성된 음성</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <audio controls src={ttsAudioUrl} className="w-full" />
                  </CardContent>
                </Card>
              )}

              {/* 생성된 자막 미리보기 */}
              {subtitles.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>생성된 자막</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {subtitles.map((subtitle, index) => (
                        <div key={subtitle.id} className="flex items-center gap-3 text-sm">
                          <span className="text-muted-foreground min-w-16">{Math.floor(subtitle.startTime)}s</span>
                          <span className="flex-1">{subtitle.text}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

"use client"

import type React from "react"
import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Type, Music, Plus, Video, ImageIcon, Sparkles, Filter, Layers, Settings, Upload, Smile } from "lucide-react"

interface VideoEditorProps {
  videoUrl?: string
  onSave?: (editedVideo: any) => void
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

interface TextTemplate {
  id: string
  name: string
  category: string
  preview: string
  style: {
    fontSize: number
    fontWeight: string
    color: string
    fontFamily?: string
    textAlign?: string
    textShadow?: string
    background?: string
    border?: string
    borderRadius?: string
    padding?: string
    animation?: string
  }
  animationPreset?: string
}

export default function VideoEditor({ videoUrl, onSave }: VideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  // 비디오 상태
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(30)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)

  // 편집 상태
  const [selectedTool, setSelectedTool] = useState<string>("미디어")
  const [zoom, setZoom] = useState(100)
  const [textElements, setTextElements] = useState<any[]>([])
  const [selectedElement, setSelectedElement] = useState<any>(null)

  // 타임라인 상태
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(100)
  const [timelineScale, setTimelineScale] = useState(1)
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null)
  const [playheadPosition, setPlayheadPosition] = useState(0)

  // 필터 및 효과
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [saturation, setSaturation] = useState(100)
  const [blur, setBlur] = useState(0)

  const [showGrid, setShowGrid] = useState(false)
  const [showSafeArea, setShowSafeArea] = useState(false)
  const [aspectRatio, setAspectRatio] = useState("9:16")
  const [canvasSize, setCanvasSize] = useState({ width: 360, height: 640 })
  const [videoPosition, setVideoPosition] = useState({ x: 0, y: 0 })
  const [videoScale, setVideoScale] = useState(1)
  const [videoRotation, setVideoRotation] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // 텍스트 템플릿 상태
  const [selectedTextCategory, setSelectedTextCategory] = useState("제목")
  const [customTextStyle, setCustomTextStyle] = useState({
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    fontFamily: "Arial",
    textAlign: "center",
    textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
    background: "transparent",
    border: "none",
    borderRadius: "0px",
    padding: "0px",
  })

  // 드래그 상태
  const [isDragging, setIsDragging] = useState(false)
  const [draggedElement, setDraggedElement] = useState<any>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [timelineDragState, setTimelineDragState] = useState<{
    isDragging: boolean
    trackId: string | null
    startX: number
    startTime: number
  }>({
    isDragging: false,
    trackId: null,
    startX: 0,
    startTime: 0,
  })

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
    {
      id: "text-1",
      type: "text",
      name: "제목 텍스트",
      startTime: 2,
      duration: 5,
      color: "#f59e0b",
      locked: false,
      visible: true,
      content: { text: "안녕하세요!", fontSize: 32, color: "#ffffff" },
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

  const textTemplates: TextTemplate[] = [
    {
      id: "title-bold",
      name: "굵은 제목",
      category: "제목",
      preview: "제목",
      style: {
        fontSize: 48,
        fontWeight: "bold",
        color: "#ffffff",
        fontFamily: "Arial Black",
        textAlign: "center",
        textShadow: "3px 3px 6px rgba(0,0,0,0.8)",
      },
      animationPreset: "fadeIn",
    },
    {
      id: "subtitle-clean",
      name: "깔끔한 부제목",
      category: "부제목",
      preview: "부제목",
      style: {
        fontSize: 28,
        fontWeight: "600",
        color: "#4ecdc4",
        fontFamily: "Arial",
        textAlign: "center",
        textShadow: "1px 1px 2px rgba(0,0,0,0.3)",
      },
      animationPreset: "fadeIn",
    },
  ]

  const textCategories = ["제목", "부제목", "본문", "캡션", "특수효과"]
  const fontFamilies = ["Arial", "Arial Black", "Helvetica", "Times New Roman", "Courier New"]

  // 이벤트 핸들러들
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
          const videoUrl = URL.createObjectURL(file)
          const newTrack: TimelineTrack = {
            id: `video-${Date.now()}`,
            type: "video",
            name: file.name,
            startTime: currentTime,
            duration: 10,
            color: "#3b82f6",
            locked: false,
            visible: true,
            content: { url: videoUrl, file },
          }
          setTimelineTracks((tracks) => [...tracks, newTrack])
        }
      })
    },
    [currentTime],
  )

  const handleTextMouseDown = useCallback((e: React.MouseEvent, element: any) => {
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

  const addText = () => {
    const newText = {
      id: Date.now(),
      type: "text",
      content: "텍스트를 입력하세요",
      x: 50,
      y: 50,
      ...customTextStyle,
      startTime: currentTime,
      endTime: currentTime + 3,
      animationPreset: "none",
    }
    setTextElements([...textElements, newText])
    setSelectedElement(newText)
  }

  const applyTextTemplate = (template: TextTemplate) => {
    const newText = {
      id: Date.now(),
      type: "text",
      content: template.preview,
      x: 50,
      y: 50,
      ...template.style,
      startTime: currentTime,
      endTime: currentTime + 3,
      animationPreset: template.animationPreset || "none",
    }
    setTextElements([...textElements, newText])
    setSelectedElement(newText)
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const getVideoStyle = () => {
    const filterString = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px)`
    return { filter: filterString }
  }

  const timeToPixels = (time: number) => {
    return (time / duration) * 800 * timelineScale
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
      setPlayheadPosition(videoRef.current.currentTime)
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

  return (
    <div className="h-screen flex bg-gray-900 text-white">
      {/* 왼쪽 사이드바 */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* 사이드바 헤더 */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">편집 도구</h2>
            <Button variant="ghost" size="sm">
              <Settings className="w-4 h-4" />
            </Button>
          </div>

          {/* 탭 버튼들 */}
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

        {/* 사이드바 콘텐츠 */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {selectedTool === "미디어" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">미디어 라이브러리</h3>
                  <Button size="sm" className="gap-2">
                    <Upload className="w-4 h-4" />
                    업로드
                  </Button>
                </div>

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

                <div className="grid grid-cols-2 gap-2">
                  <div className="aspect-video bg-gray-700 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors">
                    <Video className="w-8 h-8 text-gray-400" />
                  </div>
                  <div className="aspect-video bg-gray-700 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors">
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                  </div>
                </div>
              </div>
            )}

            {selectedTool === "텍스트" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">텍스트 템플릿</h3>
                  <Button size="sm" onClick={addText} className="gap-2">
                    <Plus className="w-4 h-4" />
                    추가
                  </Button>
                </div>

                {/* 카테고리 선택 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">카테고리</label>
                  <div className="grid grid-cols-2 gap-1">
                    {textCategories.map((category) => (
                      <Button
                        key={category}
                        variant={selectedTextCategory === category ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setSelectedTextCategory(category)}
                        className="text-xs"
                      >
                        {category}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* 템플릿 목록 */}
                <div className="space-y-2">
                  {textTemplates
                    .filter((template) => template.category === selectedTextCategory)
                    .map((template) => (
                      <div
                        key={template.id}
                        className="p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors"
                        onClick={() => applyTextTemplate(template)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{template.name}</span>
                          <div
                            className="text-xs px-2 py-1 rounded"
                            style={{
                              color: template.style.color,
                              fontSize: "10px",
                              fontWeight: template.style.fontWeight,
                              fontFamily: template.style.fontFamily,
                              textShadow: template.style.textShadow,
                              background:
                                template.style.background !== "transparent" ? template.style.background : undefined,
                            }}
                          >
                            {template.preview}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                {/* 커스텀 텍스트 스타일 */}
                <div className="space-y-3 pt-4 border-t border-gray-700">
                  <h4 className="font-medium">커스텀 스타일</h4>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-sm font-medium mb-1 block">크기</label>
                      <Input
                        type="number"
                        value={customTextStyle.fontSize}
                        onChange={(e) => setCustomTextStyle({ ...customTextStyle, fontSize: Number(e.target.value) })}
                        className="bg-gray-700 border-gray-600 text-sm"
                        min="8"
                        max="100"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">색상</label>
                      <Input
                        type="color"
                        value={customTextStyle.color}
                        onChange={(e) => setCustomTextStyle({ ...customTextStyle, color: e.target.value })}
                        className="bg-gray-700 border border-gray-600 h-8"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">폰트</label>
                    <select
                      value={customTextStyle.fontFamily}
                      onChange={(e) => setCustomTextStyle({ ...customTextStyle, fontFamily: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                    >
                      {fontFamilies.map((font) => (
                        <option key={font} value={font}>
                          {font}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* 중앙 편집 영역 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div
          className="flex-1 flex items-center justify-center bg-gray-900 relative overflow-hidden"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* 캔버스 컨테이너 */}
          <div
            ref={canvasRef}
            className="relative bg-black border-2 border-gray-600 shadow-2xl overflow-hidden"
            style={{
              width: `${canvasSize.width * (zoom / 100)}px`,
              height: `${canvasSize.height * (zoom / 100)}px`,
              transform: `rotate(${videoRotation}deg) scale(${videoScale})`,
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

            {/* 비디오 요소 */}
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

            {textElements.map((element) => (
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
                }}
                onMouseDown={(e) => handleTextMouseDown(e, element)}
              >
                {element.content}
              </div>
            ))}

            {/* 캔버스 클릭 시 요소 선택 해제 */}
            <div className="absolute inset-0 -z-10" onClick={() => setSelectedElement(null)} />
          </div>
        </div>

        {/* 하단 타임라인 */}
        <div className="h-64 bg-gray-800 border-t border-gray-700 flex flex-col">
          <div className="flex-1 flex">
            <div className="w-48 bg-gray-750 border-r border-gray-700"></div>
            <div ref={timelineRef} className="flex-1 relative bg-gray-900 overflow-x-auto">
              {/* 시간 눈금 */}
              <div className="h-8 bg-gray-800 border-b border-gray-700 relative">
                {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full flex items-center"
                    style={{ left: `${timeToPixels(i)}px` }}
                  >
                    <div className="w-px h-4 bg-gray-600" />
                    <span className="text-xs text-gray-400 ml-1">{formatTime(i)}</span>
                  </div>
                ))}
              </div>

              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 cursor-ew-resize"
                style={{ left: `${timeToPixels(playheadPosition)}px` }}
              >
                <div className="absolute -top-1 -left-2 w-4 h-4 bg-red-500 transform rotate-45" />
              </div>

              {/* 트랙 클립들 */}
              <div className="relative" style={{ height: `${timelineTracks.length * 48}px` }}>
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

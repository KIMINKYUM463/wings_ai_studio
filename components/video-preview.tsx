"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  Share2,
  Settings,
  RotateCcw,
  Maximize,
  Minimize,
  Copy,
  CheckCircle,
  Loader2,
  FileVideo,
  ImageIcon,
  Sparkles,
} from "lucide-react"

interface VideoPreviewProps {
  videoUrl?: string
  thumbnailUrl?: string
  title?: string
  description?: string
  duration?: number
  onDownload?: (format: string, quality: string) => void
  onShare?: (platform: string) => void
}

export default function VideoPreview({
  videoUrl,
  thumbnailUrl,
  title = "내 쇼츠 영상",
  description = "",
  duration = 0,
  onDownload,
  onShare,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // 다운로드 설정
  const [downloadFormat, setDownloadFormat] = useState("mp4")
  const [downloadQuality, setDownloadQuality] = useState("high")
  const [downloadProgress, setDownloadProgress] = useState(0)

  // 공유 설정
  const [shareUrl, setShareUrl] = useState("")
  const [isCopied, setIsCopied] = useState(false)

  // 편집 정보
  const [videoTitle, setVideoTitle] = useState(title)
  const [videoDescription, setVideoDescription] = useState(description)

  const formatOptions = [
    { value: "mp4", label: "MP4 (권장)" },
    { value: "mov", label: "MOV" },
    { value: "avi", label: "AVI" },
    { value: "webm", label: "WebM" },
  ]

  const qualityOptions = [
    { value: "low", label: "저화질 (720p)" },
    { value: "medium", label: "중화질 (1080p)" },
    { value: "high", label: "고화질 (1080p+)" },
    { value: "ultra", label: "최고화질 (4K)" },
  ]

  const shareOptions = [
    { id: "youtube", name: "YouTube Shorts", icon: "🎬" },
    { id: "instagram", name: "Instagram Reels", icon: "📸" },
    { id: "tiktok", name: "TikTok", icon: "🎵" },
    { id: "facebook", name: "Facebook", icon: "👥" },
    { id: "twitter", name: "Twitter", icon: "🐦" },
    { id: "link", name: "링크 복사", icon: "🔗" },
  ]

  useEffect(() => {
    if (videoUrl) {
      setShareUrl(`${window.location.origin}/share/video/${videoUrl.split("/").pop()}`)
    }
  }, [videoUrl])

  // 비디오 컨트롤
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const handleVolumeChange = (newVolume: number[]) => {
    const vol = newVolume[0] / 100
    setVolume(vol)
    if (videoRef.current) {
      videoRef.current.volume = vol
    }
  }

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // 다운로드 처리
  const handleDownload = async () => {
    if (!onDownload) return

    setIsLoading(true)
    setDownloadProgress(0)

    try {
      // 다운로드 진행률 시뮬레이션
      const interval = setInterval(() => {
        setDownloadProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval)
            return 100
          }
          return prev + 10
        })
      }, 200)

      await onDownload(downloadFormat, downloadQuality)

      setTimeout(() => {
        setIsLoading(false)
        setDownloadProgress(0)
      }, 2000)
    } catch (error) {
      console.error("Download failed:", error)
      setIsLoading(false)
      setDownloadProgress(0)
    }
  }

  // 공유 처리
  const handleShare = async (platform: string) => {
    if (platform === "link") {
      try {
        await navigator.clipboard.writeText(shareUrl)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
      } catch (error) {
        console.error("Failed to copy:", error)
      }
    } else {
      onShare?.(platform)
    }
  }

  // 시간 포맷팅
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  return (
    <div className="space-y-6">
      {/* 비디오 플레이어 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            영상 미리보기
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative bg-black rounded-lg overflow-hidden">
            {videoUrl ? (
              <div className="relative aspect-[9/16] max-w-sm mx-auto">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  poster={thumbnailUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={() => {
                    if (videoRef.current) {
                      setCurrentTime(0)
                    }
                  }}
                  className="w-full h-full object-cover"
                  onClick={togglePlay}
                />

                {/* 비디오 컨트롤 오버레이 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-4 left-4 right-4 space-y-2">
                    {/* 진행바 */}
                    <div className="w-full">
                      <input
                        type="range"
                        min={0}
                        max={duration}
                        value={currentTime}
                        onChange={(e) => handleSeek(Number(e.target.value))}
                        className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    {/* 컨트롤 버튼 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={togglePlay} className="text-white hover:bg-white/20">
                          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </Button>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={toggleMute}
                            className="text-white hover:bg-white/20"
                          >
                            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                          </Button>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={volume * 100}
                            onChange={(e) => handleVolumeChange([Number(e.target.value)])}
                            className="w-16 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        <span className="text-white text-sm">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleFullscreen}
                        className="text-white hover:bg-white/20"
                      >
                        {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="aspect-[9/16] max-w-sm mx-auto bg-gray-700 flex items-center justify-center rounded">
                <div className="text-center text-gray-400">
                  <FileVideo className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm">영상을 생성해주세요</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 영상 정보 편집 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            영상 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">제목</label>
            <Input
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="영상 제목을 입력하세요"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">설명</label>
            <Textarea
              value={videoDescription}
              onChange={(e) => setVideoDescription(e.target.value)}
              placeholder="영상 설명을 입력하세요"
              rows={3}
            />
          </div>

          {thumbnailUrl && (
            <div>
              <label className="text-sm font-medium mb-2 block">썸네일</label>
              <div className="relative w-32 h-18 bg-gray-100 rounded overflow-hidden">
                <img src={thumbnailUrl || "/placeholder.svg"} alt="Thumbnail" className="w-full h-full object-cover" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-1 right-1 bg-black/50 text-white hover:bg-black/70"
                >
                  <ImageIcon className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 다운로드 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            다운로드
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">파일 형식</label>
              <Select value={downloadFormat} onValueChange={setDownloadFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formatOptions.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">화질</label>
              <Select value={downloadQuality} onValueChange={setDownloadQuality}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {qualityOptions.map((quality) => (
                    <SelectItem key={quality.value} value={quality.value}>
                      {quality.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">다운로드 중...</span>
                <span className="text-sm text-muted-foreground">{downloadProgress}%</span>
              </div>
              <Progress value={downloadProgress} className="h-2" />
            </div>
          )}

          <Button onClick={handleDownload} disabled={!videoUrl || isLoading} className="w-full gap-2">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                다운로드 중...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                다운로드
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 공유 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            공유하기
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">공유 링크</label>
            <div className="flex gap-2">
              <Input value={shareUrl} readOnly className="flex-1" />
              <Button variant="outline" size="sm" onClick={() => handleShare("link")} className="gap-2 bg-transparent">
                {isCopied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {isCopied ? "복사됨" : "복사"}
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">플랫폼별 공유</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {shareOptions.map((option) => (
                <Button
                  key={option.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleShare(option.id)}
                  className="gap-2 bg-transparent"
                  disabled={!videoUrl}
                >
                  <span>{option.icon}</span>
                  {option.name}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 추가 작업 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            추가 작업
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <Button variant="outline" className="gap-2 bg-transparent">
              <RotateCcw className="w-4 h-4" />
              다시 편집하기
            </Button>
            <Button variant="outline" className="gap-2 bg-transparent">
              <Sparkles className="w-4 h-4" />새 쇼츠 만들기
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

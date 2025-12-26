"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  ShoppingBag,
  FileText,
  Video,
  Download,
  Loader2,
  ArrowLeft,
  Home,
  Sparkles,
  CheckCircle2,
  Image as ImageIcon,
  X,
  Play,
  Pause,
} from "lucide-react"
import { Slider } from "@/components/ui/slider"
import Link from "next/link"
import { generateShoppingScript, generateVideoWithSora2, generateImagesWith3Scenes, splitScriptIntoScenes, convertImageToVideoWithWan, generateImage, generateVideoWithSeedance, generateShortsThumbnail, generateThumbnailHookingText } from "./actions"
import { getApiKey } from "@/lib/api-keys"

// AudioBuffer를 WAV로 변환하는 함수
const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
  const length = buffer.length
  const numberOfChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2)
  const view = new DataView(arrayBuffer)
  const channels: Float32Array[] = []
  let offset = 0
  let pos = 0

  // WAV 헤더 작성
  const setUint16 = (data: number) => {
    view.setUint16(pos, data, true)
    pos += 2
  }
  const setUint32 = (data: number) => {
    view.setUint32(pos, data, true)
    pos += 4
  }

  // RIFF 헤더
  setUint32(0x46464952) // "RIFF"
  setUint32(length * numberOfChannels * 2 + 36) // 파일 크기 - 8
  setUint32(0x45564157) // "WAVE"

  // fmt 청크
  setUint32(0x20746d66) // "fmt "
  setUint32(16) // 청크 크기
  setUint16(1) // 오디오 포맷 (1 = PCM)
  setUint16(numberOfChannels) // 채널 수
  setUint32(sampleRate) // 샘플레이트
  setUint32(sampleRate * numberOfChannels * 2) // 바이트 레이트
  setUint16(numberOfChannels * 2) // 블록 정렬
  setUint16(16) // 비트 깊이

  // data 청크
  setUint32(0x61746164) // "data"
  setUint32(length * numberOfChannels * 2) // 데이터 크기

  // 채널 데이터 가져오기
  for (let i = 0; i < numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i))
  }

  // PCM 데이터 작성
  // 각 샘플을 순회하면서 모든 채널의 데이터를 인터리브 형식으로 작성
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      let sample = Math.max(-1, Math.min(1, channels[channel][i]))
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(pos, sample, true)
      pos += 2
    }
  }

  console.log("[Shopping] WAV 변환 완료:", {
    expectedSize: arrayBuffer.byteLength,
    actualPos: pos,
    length: length,
    channels: numberOfChannels,
  })

  return arrayBuffer
}

interface ScriptLine {
  id: number
  text: string
  startTime: number
  endTime: number
}

export default function ShoppingPage() {
  const [productName, setProductName] = useState("")
  const [productDescription, setProductDescription] = useState("")
  const [productImage, setProductImage] = useState<string | null>(null)
  const [productImageFile, setProductImageFile] = useState<File | null>(null)
  const [script, setScript] = useState("")
  const [videoUrl, setVideoUrl] = useState<string>("")
  const [imageUrls, setImageUrls] = useState<string[]>([]) // 3개 장면 이미지 URL 배열
  const [convertedVideoUrls, setConvertedVideoUrls] = useState<Map<number, string>>(new Map()) // 각 장면별로 변환된 영상 URL 저장
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [isConvertingToVideo, setIsConvertingToVideo] = useState<Map<number, boolean>>(new Map()) // 각 장면별 변환 중 여부
  const [activeStep, setActiveStep] = useState<"product" | "script" | "video" | "preview" | "render">("product")
  const [error, setError] = useState<string>("")
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number }>({ current: 0, total: 3 })
  
  // TTS 및 영상 렌더링 관련 상태
  const [scenes, setScenes] = useState<string[]>([]) // 3개 장면 텍스트
  const [scriptLines, setScriptLines] = useState<ScriptLine[]>([]) // 자막용 라인
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string>("")
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false)
  const [ttsProgress, setTtsProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 })
  const [isRendering, setIsRendering] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [selectedVoiceId, setSelectedVoiceId] = useState("8jHHF8rMqMlg8if2mOUe") // 기본 목소리 (ElevenLabs 여성)
  const [previewVideoElements, setPreviewVideoElements] = useState<HTMLVideoElement[]>([]) // 미리보기용 비디오 엘리먼트
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null) // 미리보기용 오디오
  const [previewAnimationFrame, setPreviewAnimationFrame] = useState<number | null>(null) // 미리보기 애니메이션 프레임
  
  // Canvas 및 미리보기 관련
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const previewContainerRef = useRef<HTMLDivElement | null>(null)
  
  // 썸네일 생성기 관련
  const [thumbnailUrl, setThumbnailUrl] = useState<string>("")
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false)
  const [thumbnailHookingText, setThumbnailHookingText] = useState<{ line1: string; line2: string }>({ line1: "", line2: "" })
  const thumbnailCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // 이미지 업로드 처리
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 이미지 파일인지 확인
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드 가능합니다.")
      return
    }

    // 파일 크기 제한 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert("이미지 크기는 10MB 이하여야 합니다.")
      return
    }

    setProductImageFile(file)

    // 미리보기를 위한 URL 생성
    const reader = new FileReader()
    reader.onloadend = () => {
      setProductImage(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // 이미지 제거
  const handleRemoveImage = () => {
    setProductImage(null)
    setProductImageFile(null)
  }

  // 대본 생성
  const handleGenerateScript = async () => {
    if (!productName.trim()) {
      alert("제품명을 입력해주세요.")
      return
    }

    const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("openai_api_key") || undefined : undefined

    if (!openaiApiKey) {
      alert("OpenAI API 키가 필요합니다. 메인 화면의 설정(톱니바퀴 아이콘)에서 API 키를 입력해주세요.")
      return
    }

    setIsGeneratingScript(true)
    setError("")

    try {
      const generatedScript = await generateShoppingScript(
        productName,
        productDescription || productName,
        openaiApiKey
      )
      setScript(generatedScript)
      setActiveStep("script")
    } catch (error) {
      console.error("대본 생성 실패:", error)
      setError(`대본 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      setIsGeneratingScript(false)
    }
  }

  // TTS 생성 (3개 장면 전체 대본) - 이미지 생성보다 먼저
  const handleGenerateTTS = async () => {
    if (!script.trim()) {
      alert("대본이 없습니다.")
      return
    }

    const elevenlabsApiKey = typeof window !== "undefined" ? localStorage.getItem("elevenlabs_api_key") || undefined : undefined

    if (!elevenlabsApiKey) {
      alert("ElevenLabs API 키가 필요합니다. 메인 화면의 설정(톱니바퀴 아이콘)에서 API 키를 입력해주세요.")
      return
    }

    setIsGeneratingTTS(true)
    setTtsProgress({ current: 0, total: 1 })
    setError("")

    try {
      // 전체 대본을 한 번에 TTS 생성 (대본 그대로 사용 - 절대 끊기면 안됨)
      console.log("[Shopping] TTS 생성 중... (ElevenLabs 여성 목소리:", selectedVoiceId, ")")
      console.log("[Shopping] 대본 전체 길이:", script.length, "자")
      console.log("[Shopping] 대본 전체 내용:", script)
      
      // 대본을 그대로 사용 (전처리 없이 원본 그대로)
      // 절대 대본을 수정하거나 자르지 않음
      const ttsText = script.trim()
      
      console.log("[Shopping] TTS에 전달할 대본 길이:", ttsText.length, "자")
      console.log("[Shopping] TTS에 전달할 대본 내용:", ttsText)
      
      const response = await fetch("/api/elevenlabs-tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: ttsText, // 원본 대본 그대로 사용 (절대 수정하지 않음)
          voiceId: selectedVoiceId, // 8jHHF8rMqMlg8if2mOUe (ElevenLabs 여성 목소리)
          apiKey: elevenlabsApiKey,
        }),
      })

      if (!response.ok) {
        let errorMessage = "TTS 생성 실패"
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`
        } catch (e) {
          const errorText = await response.text()
          errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      console.log("[Shopping] TTS API 응답:", {
        hasAudioBase64: !!data.audioBase64,
        hasAudioUrl: !!data.audioUrl,
        success: data.success,
        error: data.error,
      })
      
      if (!data.success) {
        throw new Error(data.error || "TTS 생성에 실패했습니다.")
      }
      
      if (!data.audioBase64 && !data.audioUrl) {
        throw new Error(`TTS 응답에 오디오 데이터가 없습니다. 응답: ${JSON.stringify(data)}`)
      }

      // Base64를 Blob으로 변환
      let audioBlob: Blob
      if (data.audioBase64) {
        const audioBytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0))
        audioBlob = new Blob([audioBytes], { type: "audio/mpeg" })
      } else if (data.audioUrl) {
        const audioResponse = await fetch(data.audioUrl)
        audioBlob = await audioResponse.blob()
      } else {
        throw new Error("오디오 데이터를 찾을 수 없습니다.")
      }

      // 1.5배속 처리 (피치 유지)
      console.log("[Shopping] 오디오 1.5배속 처리 시작 (피치 유지)...")
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const arrayBuffer = await audioBlob.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      
      // 원본 오디오 정보 확인
      const originalDuration = audioBuffer.duration
      const originalSampleRate = audioBuffer.sampleRate
      const originalLength = audioBuffer.length
      
      console.log("[Shopping] 원본 오디오 정보:", {
        길이: originalDuration.toFixed(3) + "초",
        샘플수: originalLength,
        샘플레이트: originalSampleRate + "Hz",
        채널수: audioBuffer.numberOfChannels
      })
      
      // 1배속으로 사용 (배속 처리 없이 원본 그대로 사용)
      // 원본 오디오를 그대로 WAV로 변환하여 전체 대본이 모두 포함되도록 함
      console.log("[Shopping] 오디오를 1배속으로 처리 (원본 그대로 사용, 전체 대본 포함)...")
      
      // WAV로 변환 (원본 그대로 사용)
      console.log("[Shopping] WAV 변환 시작...")
      const wavBuffer = audioBufferToWav(audioBuffer) // 원본 audioBuffer 사용
      const processedBlob = new Blob([wavBuffer], { type: "audio/wav" })
      
      console.log("[Shopping] ✅ 오디오 처리 완료 (1배속, 원본 그대로, 전체 대본 포함)")
      console.log("[Shopping] WAV Blob 크기:", processedBlob.size, "bytes")
      console.log("[Shopping] 최종 오디오 정보:", {
        원본_길이: originalDuration.toFixed(3) + "초",
        처리_후_길이: originalDuration.toFixed(3) + "초 (변경 없음, 전체 대본 포함)",
        WAV_크기: (processedBlob.size / 1024).toFixed(2) + "KB"
      })
      
      const audioUrl = URL.createObjectURL(processedBlob)
      console.log("[Shopping] 오디오 URL 생성:", audioUrl)
      
      // 실제 오디오 길이 (원본 그대로) 사용
      const actualAudioDuration = originalDuration
      
      // TTS 오디오 URL 설정 (확실히 설정 - 조건 없이)
      setTtsAudioUrl(audioUrl)
      console.log("[Shopping] TTS 오디오 URL 설정 완료:", audioUrl ? "있음" : "없음")
      
      // 실제 오디오 길이에 맞춰 scriptLines 시간 정보 생성/재조정
      // 3개 장면으로 나누기 (scenes가 없으면 생성)
      let sceneTexts = scenes.length > 0 ? scenes : await splitScriptIntoScenes(script)
      if (scenes.length === 0) {
        setScenes(sceneTexts)
      }
      
      // 각 장면을 문장 단위로 나누어 scriptLines 생성
      const lines: ScriptLine[] = []
      let currentTime = 0
      
      // 실제 오디오 길이에 맞춰 시간 분배
      const totalCharacters = script.length
      
      for (let i = 0; i < sceneTexts.length; i++) {
        const scene = sceneTexts[i]
        const sentences = scene.split(/[.!?。！？]\s*/).filter(s => s.trim().length > 0)
        
        for (const sentence of sentences) {
          const sentenceLength = sentence.trim().length
          const duration = (sentenceLength / totalCharacters) * actualAudioDuration * 1000 // 밀리초
          
          lines.push({
            id: lines.length + 1,
            text: sentence.trim(),
            startTime: currentTime,
            endTime: currentTime + duration,
          })
          
          currentTime += duration
        }
      }
      
      setScriptLines(lines)
      console.log("[Shopping] scriptLines 시간 정보 생성 완료 (실제 오디오 길이 기반)")
      
      setTtsProgress({ current: 1, total: 1 })
      
      alert(`TTS 생성이 완료되었습니다! (실제 길이: ${actualAudioDuration.toFixed(1)}초)`)
    } catch (error) {
      console.error("TTS 생성 실패:", error)
      setError(`TTS 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      setIsGeneratingTTS(false)
    }
  }

  // 이미지 1개만 생성 (영상은 미리보기 버튼에서)
  const handleGenerateVideo = async () => {
    if (!script.trim()) {
      alert("대본이 생성되지 않았습니다.")
      return
    }

    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("replicate_api_key") || undefined : undefined

    if (!replicateApiKey) {
      alert("Replicate API 키가 필요합니다. 메인 화면의 설정(톱니바퀴 아이콘)에서 API 키를 입력해주세요.")
      return
    }

    setIsGeneratingVideo(true)
    setError("")
    setActiveStep("video")
    setGenerationProgress({ current: 0, total: 1 })

    try {
      // 이미지를 base64로 변환 (있는 경우)
      let imageBase64: string | undefined = undefined
      if (productImage) {
        imageBase64 = productImage
      }

      // 이미지 1개 생성
      setGenerationProgress({ current: 1, total: 1 })
      const apiKey = getApiKey()
      const imageUrl = await generateImage(productName, replicateApiKey, imageBase64, productDescription, apiKey)
      
      setImageUrls([imageUrl])
      setActiveStep("render") // 이미지 확인 단계로 이동
    } catch (error) {
      console.error("이미지 생성 실패:", error)
      setError(`이미지 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
      setActiveStep("script")
    } finally {
      setIsGeneratingVideo(false)
      setGenerationProgress({ current: 0, total: 1 })
    }
  }

  // 미리보기 버튼 클릭 시 영상 생성 및 미리보기 준비
  const handleGenerateVideoFromImage = async () => {
    if (imageUrls.length === 0) {
      alert("이미지가 생성되지 않았습니다.")
      return
    }

    if (!ttsAudioUrl) {
      alert("TTS가 생성되지 않았습니다. 대본 생성 단계에서 TTS를 먼저 생성해주세요.")
      return
    }

    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("replicate_api_key") || undefined : undefined

    if (!replicateApiKey) {
      alert("Replicate API 키가 필요합니다. 메인 화면의 설정(톱니바퀴 아이콘)에서 API 키를 입력해주세요.")
      return
    }

    setIsGeneratingVideo(true)
    setError("")

    try {
      // 영상 생성 (bytedance/seedance-1-lite)
      const apiKey = getApiKey()
      const generatedVideoUrl = await generateVideoWithSeedance(imageUrls[0], productName, replicateApiKey, productDescription, apiKey)
      
      setVideoUrl(generatedVideoUrl)
      setActiveStep("preview")
      
      // 미리보기 자동 준비
      setTimeout(async () => {
        await initializePreview(generatedVideoUrl)
      }, 100)
    } catch (error) {
      console.error("영상 생성 실패:", error)
      setError(`영상 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      setIsGeneratingVideo(false)
    }
  }

  // 미리보기 초기화 (생성된 영상 + TTS + 자막)
  const initializePreview = async (generatedVideoUrl: string) => {
    if (!ttsAudioUrl || !canvasRef.current) {
      console.warn("TTS 또는 캔버스가 준비되지 않았습니다.")
      return
    }

    try {
      // 오디오 로드
      const audio = new Audio(ttsAudioUrl)
      audio.crossOrigin = "anonymous"
      
      await new Promise<void>((resolve, reject) => {
        audio.oncanplaythrough = () => resolve()
        audio.onerror = (e) => reject(e)
        audio.load()
      })
      
      setPreviewAudio(audio)
      
      // 비디오 로드
      const video = document.createElement("video")
      video.src = generatedVideoUrl
      video.crossOrigin = "anonymous"
      video.preload = "auto"
      video.muted = true // 음소거 (TTS를 별도로 재생)
      video.loop = true // 루프 (TTS 길이에 맞춰 반복)
      
      await new Promise<void>((resolve, reject) => {
        video.oncanplaythrough = () => resolve()
        video.onerror = (e) => reject(e)
        video.load()
      })
      
      setPreviewVideoElements([video])
      
      // 캔버스에 첫 프레임 그리기
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = 1080
        canvas.height = 1920
        const ctx = canvas.getContext("2d")
        if (ctx && video.videoWidth > 0) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        }
      }
      
      console.log("[Shopping] 미리보기 준비 완료")
    } catch (error) {
      console.error("[Shopping] 미리보기 준비 실패:", error)
      setError(`미리보기 준비에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    }
  }

  // 썸네일 생성
  const handleGenerateThumbnail = async () => {
    if (!productName) {
      alert("제품명이 필요합니다.")
      return
    }

    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("replicate_api_key") || undefined : undefined
    const gptApiKey = typeof window !== "undefined" ? localStorage.getItem("gpt_api_key") || undefined : undefined

    if (!replicateApiKey) {
      alert("Replicate API 키가 필요합니다. 메인 화면의 설정(톱니바퀴 아이콘)에서 API 키를 입력해주세요.")
      return
    }

    setIsGeneratingThumbnail(true)
    setError("")

    try {
      // 제품 이미지가 있으면 base64로 변환
      let imageBase64: string | undefined = undefined
      if (productImage) {
        imageBase64 = productImage
      }

      // 1. 후킹 문구 생성
      const hookingText = await generateThumbnailHookingText(productName, gptApiKey, productDescription)
      setThumbnailHookingText(hookingText)

      // 2. 썸네일 배경 이미지 생성 (영상 이미지가 있으면 참조)
      const videoImageForThumbnail = imageUrls.length > 0 ? imageUrls[0] : undefined
      const thumbnail = await generateShortsThumbnail(productName, replicateApiKey, imageBase64, productDescription, gptApiKey, videoImageForThumbnail)
      setThumbnailUrl(thumbnail)

      // 3. 캔버스에 이미지 + 텍스트 그리기
      setTimeout(() => {
        renderThumbnailWithText(thumbnail, hookingText)
      }, 100)
    } catch (error) {
      console.error("썸네일 생성 실패:", error)
      setError(`썸네일 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      setIsGeneratingThumbnail(false)
    }
  }

  // 썸네일에 텍스트 렌더링
  const renderThumbnailWithText = async (imageUrl: string, hookingText: { line1: string; line2: string }) => {
    const canvas = thumbnailCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // 캔버스 크기 설정 (9:16 비율)
    canvas.width = 1080
    canvas.height = 1920

    // 이미지 로드
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = imageUrl

    img.onload = () => {
      // 이미지 그리기
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      // 텍스트 위치 (중간에서 조금 위)
      const textY = canvas.height * 0.35

      // 첫 번째 줄 (노란색)
      ctx.font = "bold 120px 'Noto Sans KR', Arial"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"

      // 검정 테두리
      ctx.strokeStyle = "black"
      ctx.lineWidth = 16
      ctx.lineJoin = "round"
      ctx.strokeText(hookingText.line1, canvas.width / 2, textY)

      // 노란색 글씨
      ctx.fillStyle = "#FFFF00"
      ctx.fillText(hookingText.line1, canvas.width / 2, textY)

      // 두 번째 줄 (흰색)
      const textY2 = textY + 140

      // 검정 테두리
      ctx.strokeStyle = "black"
      ctx.lineWidth = 16
      ctx.lineJoin = "round"
      ctx.strokeText(hookingText.line2, canvas.width / 2, textY2)

      // 흰색 글씨
      ctx.fillStyle = "white"
      ctx.fillText(hookingText.line2, canvas.width / 2, textY2)
    }
  }

  // 썸네일 다운로드 (캔버스에서)
  const handleDownloadThumbnail = () => {
    const canvas = thumbnailCanvasRef.current
    if (!canvas) {
      alert("썸네일이 생성되지 않았습니다.")
      return
    }
    
    try {
      const dataUrl = canvas.toDataURL("image/png")
      const a = document.createElement("a")
      a.href = dataUrl
      a.download = `${productName}_쇼츠_썸네일.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (error) {
      console.error("썸네일 다운로드 실패:", error)
      alert("썸네일 다운로드에 실패했습니다.")
    }
  }

  // 미리보기 초기화 및 재생
  const handlePreview = async () => {
    // Map을 배열로 변환 (인덱스 순서대로)
    const videoUrlsArray: string[] = []
    for (let i = 0; i < imageUrls.length; i++) {
      const videoUrl = convertedVideoUrls.get(i)
      if (!videoUrl) {
        alert(`장면 ${i + 1}의 영상이 아직 변환되지 않았습니다.`)
        return
      }
      videoUrlsArray.push(videoUrl)
    }

    if (videoUrlsArray.length === 0 || !ttsAudioUrl || !canvasRef.current) {
      alert("변환된 영상과 TTS가 모두 준비되어야 합니다.")
      return
    }

    setError("")
    try {
      console.log("[Shopping] 미리보기 시작")

      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        throw new Error("Canvas context를 생성할 수 없습니다.")
      }

      // Canvas 크기를 1080x1920으로 설정
      canvas.width = 1080
      canvas.height = 1920

      // 이미 로드된 오디오와 비디오가 있으면 재사용
      let audio = previewAudio
      let videoElements = previewVideoElements

      // 오디오가 없거나 유효하지 않으면 새로 로드
      if (!audio || !audio.duration || isNaN(audio.duration)) {
        console.log("[Shopping] 오디오 새로 로드")
        const audioResponse = await fetch(ttsAudioUrl)
        const audioBlob = await audioResponse.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        audio = new Audio(audioUrl)
        audio.volume = 1.0

        await new Promise<void>((resolve, reject) => {
          audio.onloadeddata = () => resolve()
          audio.onerror = reject
        })
        setPreviewAudio(audio)
      } else {
        console.log("[Shopping] 기존 오디오 재사용")
        // 기존 오디오 재사용 시 시간 초기화
        audio.currentTime = 0
        audio.pause()
      }

      const actualAudioDuration = audio.duration
      console.log("[Shopping] 실제 오디오 길이:", actualAudioDuration.toFixed(3), "초")

      // 비디오 엘리먼트가 없거나 개수가 맞지 않으면 새로 로드
      if (!videoElements || videoElements.length !== videoUrlsArray.length) {
        console.log("[Shopping] 비디오 새로 로드")
        videoElements = []
        for (let i = 0; i < videoUrlsArray.length; i++) {
          const videoUrl = videoUrlsArray[i]
          const video = document.createElement("video")
          video.crossOrigin = "anonymous"
          video.src = videoUrl
          video.muted = true
          video.playsInline = true
          video.preload = "auto" // 미리 로드
          
          await new Promise<void>((resolve, reject) => {
            // loadedmetadata와 canplay 이벤트 사용
            let metadataLoaded = false
            let canPlay = false
            
            const checkReady = () => {
              if (metadataLoaded && canPlay) {
                video.currentTime = 0 // 시작 위치로 초기화
                console.log(`[Shopping] 비디오 ${i + 1} 로드 완료: duration=${video.duration.toFixed(2)}초`)
                resolve()
              }
            }
            
            video.onloadedmetadata = () => {
              metadataLoaded = true
              checkReady()
            }
            
            video.oncanplay = () => {
              canPlay = true
              checkReady()
            }
            
            video.onerror = (e) => {
              console.error(`[Shopping] 비디오 ${i + 1} 로드 에러:`, e)
              reject(new Error(`비디오 ${i + 1} 로드 실패`))
            }
            
            video.load()
            
            // 타임아웃 설정 (15초)
            setTimeout(() => {
              if (!metadataLoaded || !canPlay) {
                console.warn(`[Shopping] 비디오 ${i + 1} 로드 타임아웃, 계속 진행 (readyState: ${video.readyState})`)
                if (video.readyState >= 1) {
                  // 메타데이터라도 있으면 계속 진행
                  metadataLoaded = true
                  canPlay = true
                  checkReady()
                } else {
                  resolve() // 타임아웃이어도 계속 진행
                }
              }
            }, 15000)
          })
          videoElements.push(video)
        }
        setPreviewVideoElements(videoElements)
      } else {
        console.log("[Shopping] 기존 비디오 재사용")
        // 기존 비디오 재사용 시 시간 초기화
        for (const video of videoElements) {
          video.currentTime = 0
          video.pause()
        }
      }

      // 각 영상의 실제 duration 가져오기
      const videoDurations: number[] = []
      for (const video of videoElements) {
        if (video.duration && !isNaN(video.duration) && video.duration > 0) {
          videoDurations.push(video.duration)
        } else {
          // duration이 없으면 기본값 사용 (나중에 업데이트)
          videoDurations.push(5) // 기본 5초
        }
      }

      console.log("[Shopping] 각 영상의 실제 길이:", videoDurations.map(d => d.toFixed(2) + "초"))

      // 각 영상의 시작 시간 계산 (간단하게 순차적으로 이어붙이기)
      let accumulatedTime = 0
      const videoStartTimes: number[] = []
      for (let i = 0; i < videoDurations.length; i++) {
        videoStartTimes.push(accumulatedTime)
        accumulatedTime += videoDurations[i]
      }

      console.log("[Shopping] 각 영상의 시작 시간:", videoStartTimes.map(t => t.toFixed(2) + "초"))

      // 미리보기 렌더링 함수 (단순하게 - 비디오를 그냥 이어붙이기)
      let lastVideoIndex = -1
      
      const renderPreview = () => {
        const elapsed = audio.paused ? currentTime : audio.currentTime
        if (!audio.paused) {
          setCurrentTime(elapsed)
        }

        // 캔버스 초기화
        ctx.fillStyle = "black"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // 현재 시간에 맞는 영상 찾기
        let currentVideoIndex = -1
        for (let i = 0; i < videoStartTimes.length; i++) {
          const startTime = videoStartTimes[i]
          const endTime = i < videoStartTimes.length - 1 ? videoStartTimes[i + 1] : startTime + videoDurations[i]
          
          if (elapsed >= startTime && elapsed < endTime) {
            currentVideoIndex = i
            break
          }
        }

        // 비디오 전환 시에만 처리
        if (currentVideoIndex !== lastVideoIndex) {
          // 이전 비디오 일시정지
          if (lastVideoIndex >= 0 && videoElements[lastVideoIndex]) {
            videoElements[lastVideoIndex].pause()
            videoElements[lastVideoIndex].currentTime = 0
          }
          
          // 새 비디오 재생 시작
          if (currentVideoIndex >= 0 && videoElements[currentVideoIndex]) {
            const video = videoElements[currentVideoIndex]
            const videoStartTime = videoStartTimes[currentVideoIndex]
            const videoElapsed = elapsed - videoStartTime
            
            if (video && !isNaN(video.duration) && video.duration > 0) {
              // 시작 시간 설정
              video.currentTime = Math.max(0, Math.min(videoElapsed, video.duration))
              // 비디오 재생 (자체적으로 재생되도록)
              video.play().catch(() => {})
            }
          }
          
          lastVideoIndex = currentVideoIndex
        }

        // 현재 영상을 캔버스에 그리기 (매 프레임마다)
        if (currentVideoIndex >= 0 && videoElements[currentVideoIndex]) {
          const video = videoElements[currentVideoIndex]
          try {
            if (video.readyState >= 2 || (video.videoWidth > 0 && video.videoHeight > 0)) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            }
          } catch (e) {
            // 그리기 실패 시 무시
          }
        }

        // 자막 제거 (테스트용 - TTS와 영상만 재생)

        if (!audio.ended && !audio.paused) {
          const frameId = requestAnimationFrame(renderPreview)
          setPreviewAnimationFrame(frameId)
        } else {
          setIsPlaying(false)
          // 모든 비디오 일시정지
          for (const video of videoElements) {
            video.pause()
          }
        }
      }

      // 미리보기 단계로 이동
      setActiveStep("preview")
      
      // 초기 프레임 그리기 (재생하지 않고 첫 프레임만 표시)
      audio.currentTime = 0
      setCurrentTime(0)
      
      // 초기 프레임 렌더링 (시간 0으로 설정)
      const initialElapsed = 0
      
      // 캔버스 초기화
      ctx.fillStyle = "black"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // 첫 번째 영상 표시
      if (videoElements[0]) {
        const video = videoElements[0]
        video.currentTime = 0
        try {
          if (video.readyState >= 1 || (video.videoWidth > 0 && video.videoHeight > 0)) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          }
        } catch (e) {
          console.warn("초기 비디오 그리기 실패:", e)
        }
      }
      
      // 자동 재생하지 않음 (재생 버튼을 눌러야 재생됨)
    } catch (error) {
      console.error("미리보기 실패:", error)
      setError(`미리보기에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    }
  }

  // 미리보기 재생/일시정지
  const handlePreviewPlayPause = () => {
    if (!previewAudio) return

    if (isPlaying) {
      previewAudio.pause()
      // 비디오도 일시정지
      if (previewVideoElements.length > 0 && previewVideoElements[0]) {
        previewVideoElements[0].pause()
      }
      setIsPlaying(false)
      if (previewAnimationFrame) {
        cancelAnimationFrame(previewAnimationFrame)
        setPreviewAnimationFrame(null)
      }
    } else {
      previewAudio.play()
      setIsPlaying(true)
      
      // 재생 시작 시 렌더링 재개
      const canvas = canvasRef.current
      const ctx = canvas?.getContext("2d")
      if (!canvas || !ctx || !previewVideoElements.length) return

      const video = previewVideoElements[0]
      if (!video) return
      
      // 비디오 재생 시작 (TTS와 동기화)
      video.currentTime = previewAudio.currentTime
      video.play().catch(() => {})
      
      const renderPreview = () => {
        const elapsed = previewAudio.currentTime
        setCurrentTime(elapsed)

        // 캔버스 초기화
        ctx.fillStyle = "black"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // 비디오 동기화 (TTS와 비디오 시간 맞추기)
        if (video && !isNaN(video.duration) && video.duration > 0) {
          // 비디오가 TTS보다 짧으면 루프
          const videoDuration = video.duration
          const videoTime = elapsed % videoDuration
          
          // 시간 차이가 크면 동기화
          if (Math.abs(video.currentTime - videoTime) > 0.5) {
            video.currentTime = videoTime
          }
          
          // 비디오 재생 보장
          if (video.paused && !previewAudio.paused) {
            video.play().catch(() => {})
          }
        }

        // 영상을 캔버스에 그리기
        try {
          if (video.readyState >= 2 || (video.videoWidth > 0 && video.videoHeight > 0)) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          }
        } catch (e) {
          // 그리기 실패 시 무시
        }

        // 자막 그리기 (6~7자씩 나누기, 중간에서 조금 위)
        if (scriptLines.length > 0) {
          const elapsedMs = elapsed * 1000
          
          // 현재 시간에 맞는 자막 찾기
          const currentLine = scriptLines.find(
            line => elapsedMs >= line.startTime && elapsedMs < line.endTime
          )
          
          if (currentLine) {
            // 텍스트를 10자씩 나누기
            const fullText = currentLine.text
            const chunkSize = 10 // 10자씩 나누기
            const chunks: string[] = []
            for (let i = 0; i < fullText.length; i += chunkSize) {
              chunks.push(fullText.slice(i, i + chunkSize))
            }
            
            // 현재 시간 기준으로 몇 번째 청크를 보여줄지 계산
            const lineDuration = currentLine.endTime - currentLine.startTime
            const chunkDuration = lineDuration / chunks.length
            const timeInLine = elapsedMs - currentLine.startTime
            const currentChunkIndex = Math.min(Math.floor(timeInLine / chunkDuration), chunks.length - 1)
            const textToShow = chunks[currentChunkIndex] || chunks[0]
            
            const subtitleY = canvas.height * 0.38 // 화면 38% 위치 (중간에서 조금 위)
            
            // 자막 텍스트 (배경 없음, 검정 테두리)
            ctx.font = "bold 100px 'Noto Sans KR', sans-serif"
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            
            // 검정색 테두리
            ctx.strokeStyle = "black"
            ctx.lineWidth = 12
            ctx.lineJoin = "round"
            ctx.strokeText(textToShow, canvas.width / 2, subtitleY)
            
            // 흰색 글씨
            ctx.fillStyle = "white"
            ctx.fillText(textToShow, canvas.width / 2, subtitleY)
          }
        }

        if (!previewAudio.ended && !previewAudio.paused) {
          const frameId = requestAnimationFrame(renderPreview)
          setPreviewAnimationFrame(frameId)
        } else {
          setIsPlaying(false)
          video.pause()
        }
      }

      renderPreview()
    }
  }

  // 최종 영상 렌더링 (영상 + TTS + 자막)
  const handleRenderVideo = async () => {
    if (!videoUrl || !ttsAudioUrl || !canvasRef.current) {
      alert("영상과 TTS가 모두 준비되어야 합니다.")
      return
    }
    
    const videoUrlsArray = [videoUrl] // 단일 영상 사용

    setIsRendering(true)
    setError("")
    try {
      console.log("[Shopping] 최종 영상 렌더링 시작 (Canvas + MediaRecorder)")

      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        throw new Error("Canvas context를 생성할 수 없습니다.")
      }

      // Canvas 크기를 1080x1920으로 설정
      canvas.width = 1080
      canvas.height = 1920

      // 오디오 로드
      const audioResponse = await fetch(ttsAudioUrl)
      const audioBlob = await audioResponse.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)

      await new Promise<void>((resolve, reject) => {
        audio.onloadeddata = () => resolve()
        audio.onerror = reject
      })

      const actualAudioDuration = audio.duration
      console.log("[Shopping] 실제 오디오 길이:", actualAudioDuration.toFixed(3), "초")

      // 각 영상을 비디오 엘리먼트로 로드
      const videoElements: HTMLVideoElement[] = []
      for (const videoUrl of videoUrlsArray) {
        const video = document.createElement("video")
        video.crossOrigin = "anonymous"
        video.src = videoUrl
        video.muted = true
        video.playsInline = true
        video.preload = "auto" // 미리 로드
        
        await new Promise<void>((resolve, reject) => {
          // canplaythrough 이벤트 사용 (더 완전한 로드 확인)
          video.oncanplaythrough = () => {
            video.currentTime = 0 // 시작 위치로 초기화
            resolve()
          }
          video.onerror = reject
          video.load()
          
          // 타임아웃 설정 (10초)
          setTimeout(() => {
            if (video.readyState < 3) {
              console.warn("비디오 로드 타임아웃, 계속 진행")
              resolve() // 타임아웃이어도 계속 진행
            }
          }, 10000)
        })
        videoElements.push(video)
      }

      console.log("[Shopping] 모든 영상 로드 완료, 렌더링 시작...")

      // TTS 시간을 기반으로 각 장면의 영상 길이 계산
      let sceneDurations: number[] = []
      if (scenes.length > 0 && scriptLines.length > 0) {
        const linesPerScene = Math.ceil(scriptLines.length / scenes.length)

        for (let i = 0; i < scenes.length; i++) {
          const startLineIndex = i * linesPerScene
          const endLineIndex = Math.min((i + 1) * linesPerScene, scriptLines.length)

          if (startLineIndex < scriptLines.length) {
            const startTime = scriptLines[startLineIndex].startTime / 1000 // 초 단위
            const endTime = endLineIndex < scriptLines.length
              ? scriptLines[endLineIndex - 1].endTime / 1000
              : actualAudioDuration
            const duration = endTime - startTime
            sceneDurations.push(Math.max(duration, 1)) // 최소 1초
          } else {
            sceneDurations.push(actualAudioDuration / scenes.length)
          }
        }
      } else {
        sceneDurations = videoUrlsArray.map(() => actualAudioDuration / videoUrlsArray.length)
      }

      console.log("[Shopping] 각 장면의 영상 길이:", sceneDurations.map(d => d.toFixed(2) + "초"))

      // MediaRecorder 설정
      const stream = canvas.captureStream(30) // 30fps
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const source = audioContext.createMediaElementSource(audio)
      const destination = audioContext.createMediaStreamDestination()
      source.connect(destination)

      const videoTrack = stream.getVideoTracks()[0]
      const audioTrack = destination.stream.getAudioTracks()[0]
      const combinedStream = new MediaStream([videoTrack, audioTrack])

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: "video/webm;codecs=vp9,opus",
        videoBitsPerSecond: 5000000,
      })

      const chunks: Blob[] = []
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: "video/webm" })
        const finalVideoUrl = URL.createObjectURL(videoBlob)
        setVideoUrl(finalVideoUrl)
        URL.revokeObjectURL(audioUrl)

        console.log("[Shopping] 영상 렌더링 완료")
        alert("영상 렌더링이 완료되었습니다!")
        setActiveStep("preview") // 최종 완료 단계로 이동
        setIsRendering(false)
      }

      // 렌더링 시작
      mediaRecorder.start()
      audio.play()

      // 각 영상의 시작 시간 계산
      let accumulatedTime = 0
      const videoStartTimes: number[] = []
      for (let i = 0; i < sceneDurations.length; i++) {
        videoStartTimes.push(accumulatedTime)
        accumulatedTime += sceneDurations[i]
      }

      const renderFrame = () => {
        const elapsed = audio.currentTime

        // TTS 길이를 초과하면 즉시 중지
        if (elapsed >= actualAudioDuration || audio.ended || isNaN(elapsed) || !isFinite(elapsed)) {
          console.log(`[Shopping] 렌더링 종료: elapsed=${elapsed.toFixed(3)}초, actualAudioDuration=${actualAudioDuration.toFixed(3)}초, ended=${audio.ended}`)
          mediaRecorder.stop()
          audio.pause()
          audio.currentTime = 0
          return
        }

        // 캔버스 초기화
        ctx.fillStyle = "black"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // 현재 시간에 맞는 영상 찾기
        let currentVideoIndex = 0
        for (let i = 0; i < videoStartTimes.length; i++) {
          if (elapsed >= videoStartTimes[i] && (i === videoStartTimes.length - 1 || elapsed < videoStartTimes[i + 1])) {
            currentVideoIndex = i
            break
          }
        }

        // 현재 영상 재생
        if (videoElements[currentVideoIndex]) {
          const video = videoElements[currentVideoIndex]
          const videoStartTime = videoStartTimes[currentVideoIndex]
          const videoElapsed = elapsed - videoStartTime

          // 영상 시간 설정 (루프)
          if (videoElapsed >= 0 && videoElapsed < video.duration) {
            video.currentTime = videoElapsed % video.duration
            if (video.paused) {
              video.play()
            }
          }

          // 영상을 캔버스에 그리기 (1080x1920 쇼츠 크기)
          const imageWidth = 1080
          const imageHeight = 1920
          const imageX = 0
          const imageY = 0

          ctx.drawImage(video, imageX, imageY, imageWidth, imageHeight)
        }

        // 현재 자막 찾기 (6~7자씩 나누기)
        const currentLine = scriptLines.find(
          (line) => elapsed >= line.startTime / 1000 && elapsed <= line.endTime / 1000
        )

        if (currentLine) {
          // 텍스트를 10자씩 나누기
          const fullText = currentLine.text
          const chunkSize = 10
          const chunks: string[] = []
          for (let i = 0; i < fullText.length; i += chunkSize) {
            chunks.push(fullText.slice(i, i + chunkSize))
          }
          
          // 현재 시간 기준으로 몇 번째 청크를 보여줄지 계산
          const lineDuration = (currentLine.endTime - currentLine.startTime) / 1000
          const chunkDuration = lineDuration / chunks.length
          const timeInLine = elapsed - currentLine.startTime / 1000
          const currentChunkIndex = Math.min(Math.floor(timeInLine / chunkDuration), chunks.length - 1)
          const textToShow = chunks[currentChunkIndex] || chunks[0]
          
          const subtitleY = canvas.height * 0.38 // 38% 위치 (중간에서 조금 위)

          // 자막 텍스트 (배경 없음, 검정 테두리)
          ctx.font = "bold 120px 'Noto Sans KR', Arial"
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"

          // 검정색 테두리
          ctx.strokeStyle = "black"
          ctx.lineWidth = 14
          ctx.lineJoin = "round"
          ctx.strokeText(textToShow, canvas.width / 2, subtitleY)
          
          // 흰색 글씨
          ctx.fillStyle = "white"
          ctx.fillText(textToShow, canvas.width / 2, subtitleY)
        }

        // 다음 프레임 요청
        requestAnimationFrame(renderFrame)
      }

      renderFrame()
    } catch (error) {
      console.error("영상 렌더링 실패:", error)
      setError(`영상 렌더링에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
      setIsRendering(false)
    }
  }

  // 개별 장면을 영상으로 변환
  const handleConvertImageToVideo = async (sceneIndex: number) => {
    if (imageUrls.length === 0) {
      alert("이미지가 준비되어야 합니다.")
      return
    }

    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("replicate_api_key") || undefined : undefined

    if (!replicateApiKey) {
      alert("Replicate API 키가 필요합니다. 메인 화면의 설정(톱니바퀴 아이콘)에서 API 키를 입력해주세요.")
      return
    }

    // 해당 장면의 변환 상태를 true로 설정
    setIsConvertingToVideo((prev) => {
      const newMap = new Map(prev)
      newMap.set(sceneIndex, true)
      return newMap
    })
    setError("")
    try {
      console.log(`[Shopping] 장면 ${sceneIndex + 1} 영상 변환 시작`)

      // 각 장면의 프롬프트 생성 (장면 텍스트 사용)
      const scenePrompt = scenes[sceneIndex] || `Product showcase scene ${sceneIndex + 1}`
      
      // lightricks/ltx-video 모델 사용 (오디오 불필요)
      const videoUrl = await convertImageToVideoWithWan(
        imageUrls[sceneIndex],
        scenePrompt,
        undefined, // 오디오는 선택사항 (ltx-video는 오디오 불필요)
        replicateApiKey
      )
      
      // 변환된 영상 URL 저장
      setConvertedVideoUrls((prev) => {
        const newMap = new Map(prev)
        newMap.set(sceneIndex, videoUrl)
        return newMap
      })
      
      console.log(`[Shopping] 장면 ${sceneIndex + 1} 영상 변환 완료:`, videoUrl)
      alert(`장면 ${sceneIndex + 1} 영상 변환이 완료되었습니다!`)
    } catch (error) {
      console.error(`[Shopping] 장면 ${sceneIndex + 1} 영상 변환 실패:`, error)
      setError(`장면 ${sceneIndex + 1} 영상 변환에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      // 해당 장면의 변환 상태를 false로 설정
      setIsConvertingToVideo((prev) => {
        const newMap = new Map(prev)
        newMap.set(sceneIndex, false)
        return newMap
      })
    }
  }

  // 비디오 다운로드
  const handleDownload = () => {
    if (!videoUrl) return

    const link = document.createElement("a")
    link.href = videoUrl
    link.download = `${productName}_shopping_video.mp4`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const renderStepContent = () => {
    switch (activeStep) {
      case "product":
        return (
          <div className="space-y-6">
            <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-gray-800">
                  제품 정보
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 py-2">
                <div className="space-y-2">
                  <Label htmlFor="product-name" className="text-sm font-medium text-gray-800">
                    제품명 <span className="text-red-500">*</span>
                  </Label>
                  <p className="text-xs text-gray-500">예: 무선 블루투스 이어폰</p>
                  <Input
                    id="product-name"
                    placeholder="제품명을 입력해주세요"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product-description" className="text-sm font-medium text-gray-800">
                    제품 설명 (선택사항)
                  </Label>
                  <p className="text-xs text-gray-500">
                    제품의 주요 특징, 장점 등을 입력해주세요. 비워두면 제품명만으로 대본을 생성합니다.
                  </p>
                  <Textarea
                    id="product-description"
                    placeholder="제품 설명을 입력해주세요"
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product-image" className="text-sm font-medium text-gray-800">
                    제품 이미지 (선택사항)
                  </Label>
                  {!productImage ? (
                    <div className="border-dashed border-gray-300 rounded-xl bg-gray-50 p-8 md:p-12 text-center hover:border-orange-400 transition-colors">
                      <input
                        type="file"
                        id="product-image"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="product-image"
                        className="cursor-pointer flex flex-col items-center gap-3"
                      >
                        <ImageIcon className="w-10 h-10 text-gray-400" />
                        <div className="space-y-1">
                          <span className="text-xs md:text-sm text-gray-500 block">
                            이미지를 클릭하거나 드래그하여 업로드
                          </span>
                          <span className="text-xs text-gray-400 block">
                            PNG, JPG, GIF (최대 10MB)
                          </span>
                        </div>
                      </label>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="relative w-full h-64 rounded-lg overflow-hidden border-2 border-gray-200">
                        <img
                          src={productImage}
                          alt="제품 이미지"
                          className="w-full h-full object-contain bg-gray-50"
                        />
                        <button
                          onClick={handleRemoveImage}
                          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md"
                          type="button"
                          aria-label="이미지 제거"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        이미지가 업로드되었습니다. 다른 이미지를 업로드하려면 제거 후 다시 업로드하세요.
                      </p>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <Button
                  onClick={handleGenerateScript}
                  disabled={!productName.trim() || isGeneratingScript}
                  className="w-full h-12 md:h-14 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold rounded-xl disabled:bg-orange-300 disabled:cursor-not-allowed transition-colors"
                  size="lg"
                >
                  {isGeneratingScript ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      대본 생성 중...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      대본 생성하기
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )

      case "script":
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">생성된 대본</h2>
              <p className="text-muted-foreground">대본을 확인하고 수정할 수 있습니다</p>
            </div>

            <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    대본 (15초)
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateScript}
                    disabled={isGeneratingScript}
                    className="text-sm"
                  >
                    {isGeneratingScript ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        재생성 중...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        대본 재생성
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  rows={6}
                  className="font-medium"
                  placeholder="대본이 여기에 표시됩니다..."
                />

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                    {error}
                  </div>
                )}

                {/* TTS 생성 버튼 */}
                <Card className="border border-gray-200 rounded-xl bg-gray-50">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-800">TTS 생성</h3>
                        <p className="text-sm text-gray-600">대본을 음성으로 변환합니다</p>
                      </div>
                      <Button
                        onClick={handleGenerateTTS}
                        disabled={isGeneratingTTS || !!ttsAudioUrl}
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                      >
                        {isGeneratingTTS ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            생성 중...
                          </>
                        ) : ttsAudioUrl ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            생성 완료
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            TTS 생성
                          </>
                        )}
                      </Button>
                    </div>
                    {ttsProgress.total > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span>진행 상황</span>
                          <span>{ttsProgress.current} / {ttsProgress.total}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${(ttsProgress.current / ttsProgress.total) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {ttsAudioUrl ? (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          <span>TTS 생성 완료 - 미리듣기 가능</span>
                        </div>
                        <audio 
                          controls 
                          src={ttsAudioUrl} 
                          className="w-full"
                          preload="auto"
                          onLoadedMetadata={(e) => {
                            const audio = e.currentTarget
                            console.log("[Shopping] ✅ 오디오 메타데이터 로드 완료:", {
                              duration: audio.duration,
                              readyState: audio.readyState,
                              networkState: audio.networkState,
                            })
                            // 오디오 길이 확인
                            if (audio.duration && audio.duration > 0) {
                              console.log("[Shopping] ✅ 오디오 전체 길이:", audio.duration.toFixed(3), "초")
                            } else {
                              console.error("[Shopping] ❌ 오류: 오디오 길이를 확인할 수 없습니다!")
                            }
                          }}
                          onLoadedData={(e) => {
                            const audio = e.currentTarget
                            console.log("[Shopping] ✅ 오디오 데이터 로드 완료:", {
                              duration: audio.duration,
                              readyState: audio.readyState,
                            })
                          }}
                          onCanPlay={(e) => {
                            const audio = e.currentTarget
                            console.log("[Shopping] ✅ 오디오 재생 가능:", {
                              duration: audio.duration,
                              readyState: audio.readyState,
                            })
                          }}
                          onTimeUpdate={(e) => {
                            const audio = e.currentTarget
                            // 재생 진행률 로그 (25% 단위로 한 번만)
                            if (audio.duration > 0) {
                              const progress = Math.floor((audio.currentTime / audio.duration) * 100)
                              const lastProgress = (audio as any).__lastProgress || 0
                              if (progress !== lastProgress && progress % 25 === 0 && progress > 0) {
                                console.log(`[Shopping] 오디오 재생 진행: ${progress}% (${audio.currentTime.toFixed(2)}초 / ${audio.duration.toFixed(2)}초)`)
                                ;(audio as any).__lastProgress = progress
                              }
                            }
                          }}
                          onError={(e) => {
                            const audio = e.currentTarget
                            console.error("[Shopping] ❌ 오디오 로드 오류:", {
                              error: audio.error,
                              code: audio.error?.code,
                              message: audio.error?.message,
                            })
                          }}
                          onEnded={() => {
                            console.log("[Shopping] ✅ 오디오 재생 완료 - 전체 대본이 재생되었습니다")
                          }}
                        />
                        <p className="text-xs text-gray-600">위 플레이어에서 생성된 음성을 확인할 수 있습니다.</p>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-gray-500">
                        TTS 생성 후 미리듣기가 가능합니다.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setActiveStep("product")}
                    className="flex-1"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    이전
                  </Button>
                  <Button
                    onClick={handleGenerateVideo}
                    disabled={!script.trim() || isGeneratingVideo}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
                    size="lg"
                  >
                    {isGeneratingVideo ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        이미지 생성 중...
                      </>
                    ) : (
                      <>
                        <Video className="w-4 h-4 mr-2" />
                        이미지 생성하기
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case "video":
        return (
          <div className="space-y-6">
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <Loader2 className="w-12 h-12 animate-spin mx-auto text-orange-500" />
                  <div>
                    <h3 className="text-xl font-semibold mb-2">영상 생성 중...</h3>
                    <p className="text-muted-foreground mb-4">
                      대본을 3개 장면으로 나누고 있습니다.
                      <br />
                      각 장면에 대해 나노바나나로 이미지를 생성합니다.
                      <br />
                      이 작업은 몇 분 정도 소요될 수 있습니다.
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>진행 상황</span>
                        <span>{generationProgress.current} / {generationProgress.total} 장면</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-orange-500 h-2.5 rounded-full transition-all duration-300"
                          style={{
                            width: `${(generationProgress.current / generationProgress.total) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case "preview":
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">미리보기</h2>
              <p className="text-muted-foreground">영상을 미리보고 다운로드하세요</p>
            </div>

            <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="w-5 h-5" />
                  영상 미리보기
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="space-y-4">
                  {/* 영상 미리보기 + 썸네일 생성기 */}
                  <div className="flex justify-center gap-6 flex-wrap">
                    {/* 캔버스 미리보기 */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-center text-gray-600">영상 미리보기</h3>
                      <div className="relative" style={{ width: "300px", height: "533px" }}>
                        <canvas
                          ref={canvasRef}
                          className="w-full h-full border-2 border-gray-300 rounded-lg"
                          style={{ aspectRatio: "9/16" }}
                      />
                    </div>
                    </div>

                    {/* 썸네일 생성기 */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-center text-gray-600">썸네일 생성기</h3>
                      <div className="relative" style={{ width: "300px", height: "533px" }}>
                        {thumbnailUrl ? (
                          <canvas
                            ref={thumbnailCanvasRef}
                            className="w-full h-full border-2 border-gray-300 rounded-lg"
                            style={{ aspectRatio: "9/16" }}
                          />
                        ) : (
                          <div className="w-full h-full border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                            <span className="text-gray-400 text-sm">썸네일 생성 버튼을 눌러주세요</span>
                          </div>
                        )}
                      </div>
                    <div className="flex gap-2">
                      <Button
                          onClick={handleGenerateThumbnail}
                          disabled={isGeneratingThumbnail}
                          className="flex-1 bg-purple-500 hover:bg-purple-600 text-white"
                          size="sm"
                        >
                          {isGeneratingThumbnail ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              생성 중...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              썸네일 생성
                            </>
                          )}
                        </Button>
                        {thumbnailUrl && (
                          <Button
                            onClick={handleDownloadThumbnail}
                            variant="outline"
                            size="sm"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 재생 컨트롤 */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-4">
                      <Button
                        onClick={handlePreviewPlayPause}
                        disabled={!previewAudio}
                        size="lg"
                        className="w-32"
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="w-4 h-4 mr-2" />
                            일시정지
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            재생
                          </>
                        )}
                      </Button>
                    </div>

                    {/* 재생바 */}
                    {previewAudio && (
                      <div className="space-y-2">
                        <Slider
                          value={[currentTime]}
                          max={previewAudio.duration || 1}
                          step={0.1}
                          onValueChange={(value) => {
                            if (previewAudio) {
                              const newTime = value[0]
                              previewAudio.currentTime = newTime
                              setCurrentTime(newTime)
                              
                              // 시간 변경 시 프레임 업데이트
                              const canvas = canvasRef.current
                              const ctx = canvas?.getContext("2d")
                              if (canvas && ctx && previewVideoElements.length > 0) {
                                const video = previewVideoElements[0]
                                const elapsed = newTime
                                
                                // 캔버스 초기화
                                ctx.fillStyle = "black"
                                ctx.fillRect(0, 0, canvas.width, canvas.height)
                                
                                // 비디오 시간 설정 (루프)
                                if (video && !isNaN(video.duration) && video.duration > 0) {
                                  const videoTime = elapsed % video.duration
                                  video.currentTime = videoTime
                                  
                                  try {
                                    if (video.readyState >= 1 || (video.videoWidth > 0 && video.videoHeight > 0)) {
                                      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
                                    }
                                  } catch (e) {
                                    console.warn("비디오 그리기 실패:", e)
                                  }
                                }
                                
                                // 자막 그리기 (6~7자씩 나누기, 중간에서 조금 위)
                                if (scriptLines.length > 0) {
                                  const elapsedMs = elapsed * 1000
                                  const currentLine = scriptLines.find(
                                    line => elapsedMs >= line.startTime && elapsedMs < line.endTime
                                  )
                                  
                                  if (currentLine) {
                                    // 텍스트를 10자씩 나누기
                                    const fullText = currentLine.text
                                    const chunkSize = 10
                                    const chunks: string[] = []
                                    for (let i = 0; i < fullText.length; i += chunkSize) {
                                      chunks.push(fullText.slice(i, i + chunkSize))
                                    }
                                    
                                    const lineDuration = currentLine.endTime - currentLine.startTime
                                    const chunkDuration = lineDuration / chunks.length
                                    const timeInLine = elapsedMs - currentLine.startTime
                                    const currentChunkIndex = Math.min(Math.floor(timeInLine / chunkDuration), chunks.length - 1)
                                    const textToShow = chunks[currentChunkIndex] || chunks[0]
                                    
                                    const subtitleY = canvas.height * 0.38
                                    
                                    // 자막 텍스트 (배경 없음, 검정 테두리)
                                    ctx.font = "bold 100px 'Noto Sans KR', sans-serif"
                                    ctx.textAlign = "center"
                                    ctx.textBaseline = "middle"
                                    
                                    // 검정색 테두리
                                    ctx.strokeStyle = "black"
                                    ctx.lineWidth = 12
                                    ctx.lineJoin = "round"
                                    ctx.strokeText(textToShow, canvas.width / 2, subtitleY)
                                    
                                    // 흰색 글씨
                                    ctx.fillStyle = "white"
                                    ctx.fillText(textToShow, canvas.width / 2, subtitleY)
                                  }
                                }
                              }
                            }
                          }}
                          className="w-full"
                        />
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>{Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, "0")}</span>
                          <span>{Math.floor((previewAudio.duration || 0) / 60)}:{(Math.floor((previewAudio.duration || 0) % 60)).toString().padStart(2, "0")}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 다운로드 버튼 */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleRenderVideo}
                      disabled={isRendering}
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
                      size="lg"
                    >
                      {isRendering ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          렌더링 중...
                        </>
                      ) : (
                        <>
                        <Download className="w-4 h-4 mr-2" />
                          영상 다운로드 (렌더링)
                        </>
                      )}
                      </Button>
                    </div>

                  {/* 다운로드된 영상이 있으면 표시 */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setActiveStep("render")}
                        className="flex-1"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        이전
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setActiveStep("product")
                          setProductName("")
                          setProductDescription("")
                          setProductImage(null)
                          setProductImageFile(null)
                          setScript("")
                          setVideoUrl("")
                          setImageUrls([])
                          setTtsAudioUrl("")
                          setScenes([])
                          setScriptLines([])
                          setError("")
                        if (previewAudio) {
                          previewAudio.pause()
                          previewAudio.currentTime = 0
                        }
                        if (previewAnimationFrame) {
                          cancelAnimationFrame(previewAnimationFrame)
                        }
                        setIsPlaying(false)
                        setCurrentTime(0)
                        }}
                        className="flex-1"
                      >
                        <Home className="w-4 h-4 mr-2" />
                        처음으로
                      </Button>
                    </div>
                  </div>
              </CardContent>
            </Card>
          </div>
        )

      case "render":
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">이미지 생성 완료</h2>
              <p className="text-muted-foreground">생성된 이미지를 확인하고 영상을 제작하세요</p>
            </div>

            <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5" />
                  생성된 이미지
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {imageUrls.length > 0 ? (
                  <div className="space-y-6">
                    {/* 이미지 표시 (1개) */}
                    <div className="flex justify-center">
                      <div className="space-y-2 max-w-xs">
                            <div className="relative w-full aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200 shadow-sm">
                              <img
                            src={imageUrls[0]}
                            alt="생성된 이미지"
                                className="w-full h-full object-cover"
                              />
                            </div>
                              </div>
                    </div>

                    {/* 미리보기 버튼 (영상 생성) */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                        onClick={() => setActiveStep("script")}
                          className="flex-1"
                        >
                          <ArrowLeft className="w-4 h-4 mr-2" />
                          이전
                        </Button>
                        <Button
                        onClick={handleGenerateVideoFromImage}
                        disabled={isGeneratingVideo}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
                          size="lg"
                        >
                        {isGeneratingVideo ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            영상 생성 중...
                            </>
                          ) : (
                            <>
                            <Play className="w-4 h-4 mr-2" />
                            미리보기 (영상 생성)
                            </>
                          )}
                        </Button>
                      </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    이미지가 생성되지 않았습니다.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-between mb-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <Home className="w-4 h-4 mr-2" />
                홈으로
              </Button>
            </Link>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-200/50 text-orange-700 text-sm font-medium">
              <ShoppingBag className="w-4 h-4" />
              쿠팡파트너스
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold text-orange-700 text-center mb-2">
            제품 기반 쇼핑 영상 제작
          </h1>
          <p className="text-center text-sm md:text-base text-gray-600">
            AI가 제품 정보를 분석하여 15초 쇼핑 영상을 자동으로 제작합니다
          </p>
        </div>

        {/* 진행 단계 표시 */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-center gap-2 md:gap-4">
            {[
              { step: "product", label: "제품 입력", icon: ShoppingBag },
              { step: "script", label: "대본 생성(TTS)", icon: FileText },
              { step: "video", label: "이미지 생성", icon: ImageIcon },
              { step: "render", label: "영상 생성", icon: Video },
              { step: "preview", label: "완료", icon: CheckCircle2 },
            ].map((item, index) => {
              const Icon = item.icon
              const isActive = activeStep === item.step
              const isCompleted =
                (activeStep === "script" && index < 1) ||
                (activeStep === "video" && index < 2) ||
                (activeStep === "render" && index < 3) ||
                (activeStep === "preview" && index < 4)

              return (
                <div key={item.step} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${
                        isActive
                          ? "bg-orange-100 text-orange-600"
                          : isCompleted
                            ? "bg-green-100 text-green-600"
                            : "bg-white text-gray-400"
                      }`}
                    >
                      <Icon className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <span
                      className={`text-xs md:text-sm mt-2 ${
                        isActive
                          ? "text-orange-600 font-semibold"
                          : isCompleted
                            ? "text-green-600 font-medium"
                            : "text-gray-500 font-normal"
                      }`}
                    >
                      {item.label}
                    </span>
                    {isActive && (
                      <div className="w-full h-1 bg-orange-400 rounded-full mt-1" />
                    )}
                  </div>
                  {index < 4 && (
                    <div
                      className={`w-8 md:w-12 h-0.5 mx-2 ${
                        isCompleted ? "bg-green-400" : "bg-gray-300"
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 메인 컨텐츠 */}
        {renderStepContent()}
        
        {/* 숨겨진 Canvas (렌더링용) */}
        <canvas
          ref={canvasRef}
          width={1080}
          height={1920}
          className="hidden"
          style={{ width: "1080px", height: "1920px" }}
        />
      </div>
    </div>
  )
}


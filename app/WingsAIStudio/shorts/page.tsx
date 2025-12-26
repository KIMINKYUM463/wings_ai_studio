"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Lightbulb,
  FileText,
  Wand2,
  ImageIcon,
  Volume2,
  Video,
  Download,
  Sparkles,
  Clock,
  ArrowLeft,
  Play,
  Pause,
  Home,
  Loader2,
  Upload,
  X,
  GripVertical,
} from "lucide-react"
import Link from "next/link"
import { generateShortsScript, generateShortsTopics, generateShortsHookingTitle } from "./actions"
import { generateImagePrompt, generateImageWithReplicate } from "../longform/actions"
import { Label } from "@/components/ui/label"
import { getApiKey } from "@/lib/api-keys"
import { Slider } from "@/components/ui/slider"

type ShortsCategory = "wisdom" | "health" | "self_improvement" | "society" | "history" | "space" | "fortune" | "psychology" | "custom"
type ShortsDuration = 1 | 2 | 3

const categoryInfo = {
  wisdom: { name: "명언", icon: "💡", gradient: "from-yellow-400 to-orange-500" },
  health: { name: "건강", icon: "🏥", gradient: "from-green-400 to-emerald-500" },
  self_improvement: { name: "자기계발", icon: "📚", gradient: "from-indigo-400 to-blue-500" },
  society: { name: "사회(트렌드)", icon: "📱", gradient: "from-violet-400 to-purple-500" },
  history: { name: "역사", icon: "📜", gradient: "from-blue-400 to-cyan-500" },
  space: { name: "우주", icon: "🌌", gradient: "from-indigo-600 to-purple-600" },
  fortune: { name: "사주", icon: "🔮", gradient: "from-pink-400 to-rose-500" },
  psychology: { name: "심리학", icon: "🧠", gradient: "from-purple-400 to-pink-500" },
  custom: { name: "직접입력", icon: "✏️", gradient: "from-gray-400 to-gray-600" },
}

// 카테고리 순서 정의 (직접입력이 맨 마지막)
const categoryOrder: ShortsCategory[] = [
  "wisdom",
  "health",
  "self_improvement",
  "society",
  "history",
  "space",
  "fortune",
  "psychology",
  "custom",
]

export default function ShortsPage() {
  const [activeStep, setActiveStep] = useState<"category" | "topic" | "script" | "image" | "tts" | "preview" | "render">("category")
  const [selectedCategory, setSelectedCategory] = useState<ShortsCategory | null>(null)
  const [selectedDuration, setSelectedDuration] = useState<ShortsDuration>(1)
  const [topics, setTopics] = useState<string[]>([])
  const [selectedTopic, setSelectedTopic] = useState<string>("")
  const [customTopic, setCustomTopic] = useState<string>("") // 직접입력 주제
  const [script, setScript] = useState<string>("")
  const [scriptSummary, setScriptSummary] = useState<string>("") // 대본 요약 상태
  const [hookingTitle, setHookingTitle] = useState<{ line1: string; line2: string } | null>(null)
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false)
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false)
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<Array<{ lineId: number; imageUrl: string; prompt: string; order: number; isUserUploaded?: boolean }>>([])
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null)
  const [isGeneratingImages, setIsGeneratingImages] = useState(false)
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string>("")
  const [isGeneratingTts, setIsGeneratingTts] = useState(false)
  const [ttsGenerationProgress, setTtsGenerationProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 })
  const [generatedAudios, setGeneratedAudios] = useState<Array<{ lineId: number; audioUrl?: string; audioBase64?: string; audioBuffer?: AudioBuffer; duration?: number }>>([])
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("ttsmaker-여성1") // 기본: TTSMaker 여성1
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null)
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null)
  // 이미지 스타일 선택
  const [imageStyle, setImageStyle] = useState<string>("stickman-animation")
  const [videoUrl, setVideoUrl] = useState<string>("")
  const [isRendering, setIsRendering] = useState(false)

  // 페이지 마운트 시 및 프로젝트 데이터 변경 시 상태 초기화
  useEffect(() => {
    // isGeneratingTitle이 true로 남아있을 수 있으므로 초기화
    setIsGeneratingTitle(false)
    
    // 프로젝트 데이터 확인 및 상태 복원
    const projectDataStr = localStorage.getItem("longform_project_data")
    if (projectDataStr) {
      try {
        const projectData = JSON.parse(projectDataStr)
        // 프로젝트 데이터에서 쇼츠 관련 데이터 복원
        if (projectData.script) {
          setScript(projectData.script)
        }
        // 롱폼 페이지의 summarizedScript를 scriptSummary로 매핑
        if (projectData.summarizedScript) {
          setScriptSummary(projectData.summarizedScript)
        } else if (projectData.scriptSummary) {
          // 기존 프로젝트 호환성
          setScriptSummary(projectData.scriptSummary)
        }
        // 롱폼 페이지의 shortsHookingTitle을 hookingTitle로 매핑
        if (projectData.shortsHookingTitle) {
          setHookingTitle(projectData.shortsHookingTitle)
        } else if (projectData.hookingTitle) {
          // 기존 프로젝트 호환성
          setHookingTitle(projectData.hookingTitle)
        }
        // activeStep이 script 이상이면 script로 설정
        if (projectData.script) {
          setActiveStep("script")
        }
      } catch (error) {
        console.error("[Shorts] 프로젝트 데이터 파싱 실패:", error)
      }
    }
  }, [])
  const [scriptLines, setScriptLines] = useState<Array<{ id: number; text: string; startTime: number; endTime: number }>>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(1) // 볼륨 (0-1)
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  const titlePreviewCanvasRef = useRef<HTMLCanvasElement>(null)

  // 주제 생성
  const handleGenerateTopics = async () => {
    if (!selectedCategory) return

    // 직접입력인 경우 주제 15개 생성
    if (selectedCategory === "custom") {
      if (!customTopic.trim()) {
        alert("주제를 입력해주세요.")
        return
      }
      
      // 로컬스토리지에서 직접 가져오기
      const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("openai_api_key") || undefined : undefined
      
      if (!openaiApiKey) {
        alert("OpenAI API 키가 필요합니다. 메인 화면의 설정(톱니바퀴 아이콘)에서 API 키를 입력해주세요.")
        return
      }

      setIsGeneratingTopics(true)
      try {
        const topics = await generateShortsTopics("custom", openaiApiKey, customTopic.trim())
        setTopics(topics)
        setActiveStep("topic")
      } catch (error) {
        console.error("주제 생성 실패:", error)
        alert(`주제 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
      } finally {
        setIsGeneratingTopics(false)
      }
      return
    }

    // 로컬스토리지에서 직접 가져오기 (롱폼과 동일한 방식)
    const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("openai_api_key") || undefined : undefined
    
    if (!openaiApiKey) {
      alert("OpenAI API 키가 필요합니다. 메인 화면의 설정(톱니바퀴 아이콘)에서 API 키를 입력해주세요.")
      return
    }

    setIsGeneratingTopics(true)
    try {
      const topics = await generateShortsTopics(selectedCategory as "wisdom" | "health" | "self_improvement" | "society" | "history" | "space" | "fortune" | "psychology", openaiApiKey)
      setTopics(topics)
      setActiveStep("topic")
    } catch (error) {
      console.error("주제 생성 실패:", error)
      alert(`주제 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      setIsGeneratingTopics(false)
    }
  }

  // 대본 생성
  const handleGenerateScript = async () => {
    if (!selectedTopic) {
      alert("주제를 선택해주세요.")
      return
    }

    // 로컬스토리지에서 직접 가져오기
    const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("openai_api_key") || undefined : undefined
    
    if (!openaiApiKey) {
      alert("OpenAI API 키가 필요합니다. 메인 화면의 설정(톱니바퀴 아이콘)에서 API 키를 입력해주세요.")
      return
    }

    setIsGeneratingScript(true)
    try {
      const scriptText = await generateShortsScript(selectedTopic, selectedDuration, openaiApiKey)
      console.log("[Shorts] 대본 생성 완료, 길이:", scriptText?.length || 0)
      
      // 목표 길이 확인 및 경고
      const targetChars = {
        1: 414, // 1분 = 60초 * 6.9
        2: 828, // 2분 = 120초 * 6.9
        3: 1242, // 3분 = 180초 * 6.9
      }[selectedDuration]
      
      const actualLength = scriptText.length
      const expectedDuration = actualLength / 6.9 / 60 // 분 단위
      
      console.log(`[Shorts] 목표 길이: ${targetChars}자, 실제 길이: ${actualLength}자, 예상 시간: ${expectedDuration.toFixed(2)}분`)
      
      // 목표 길이의 150%를 초과하면 경고
      if (actualLength > targetChars * 1.5) {
        const warningMessage = `⚠️ 경고: 생성된 대본이 목표 길이(${targetChars}자)보다 훨씬 깁니다.\n\n` +
          `실제 길이: ${actualLength}자\n` +
          `예상 시간: 약 ${expectedDuration.toFixed(1)}분\n\n` +
          `목표 시간(${selectedDuration}분)보다 길어질 수 있습니다. 대본을 수정하거나 다시 생성해주세요.`
        alert(warningMessage)
      } else if (actualLength > targetChars * 1.2) {
        const infoMessage = `ℹ️ 생성된 대본이 목표 길이보다 약간 깁니다.\n\n` +
          `실제 길이: ${actualLength}자\n` +
          `예상 시간: 약 ${expectedDuration.toFixed(1)}분\n\n` +
          `목표 시간(${selectedDuration}분)보다 약간 길 수 있습니다.`
        console.warn("[Shorts]", infoMessage)
      }
      
      setScript(scriptText)

      // 대본을 문장 단위로 분할 (각 문장당 하나의 이미지)
      const totalLength = scriptText.length
      const lines: Array<{ id: number; text: string; startTime: number; endTime: number }> = []
      let currentTime = 0
      const charsPerSecond = 6.9 // 초당 문자 수

      // 문장 단위로 분할 (마침표, 느낌표, 물음표 기준)
      const sentences = scriptText
        .split(/[.!?。！？]\s*/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0)
        .map((s: string) => {
          // 마침표가 제거되었으므로 다시 추가
          if (!s.endsWith(".") && !s.endsWith("!") && !s.endsWith("?") && !s.endsWith("。") && !s.endsWith("！") && !s.endsWith("？")) {
            return s + "."
          }
          return s
        })

      // 각 문장을 하나의 라인으로 생성
      sentences.forEach((sentence: string, index: number) => {
        const duration = (sentence.length / charsPerSecond) * 1000
        lines.push({
          id: index + 1,
          text: sentence,
          startTime: currentTime,
          endTime: currentTime + duration,
        })
        currentTime += duration
      })

      setScriptLines(lines)
      setActiveStep("script")

      // 대본 생성 후 자동으로 제목 생성 시도 (대본 기반)
      if (scriptText && openaiApiKey) {
        try {
          console.log("[Shorts] 대본 생성 완료 - 자동 제목 생성 시작 (대본 기반)")
          // 대본의 앞부분을 요약으로 사용 (주제 대신 대본 요약 사용)
          const scriptSummary = scriptText.substring(0, 200).replace(/\n/g, " ").trim()
          const topicToUse = scriptSummary.length > 100 
            ? scriptSummary.substring(0, 100) + "..." 
            : scriptSummary
          const title = await generateShortsHookingTitle(topicToUse, scriptText, openaiApiKey)
          console.log("[Shorts] 자동 생성된 제목:", title)
          setHookingTitle(title)
        } catch (error) {
          console.error("[Shorts] 자동 제목 생성 실패:", error)
          // 제목 생성 실패해도 계속 진행
        }
      }
    } catch (error) {
      console.error("대본 생성 실패:", error)
      alert("대본 생성에 실패했습니다.")
    } finally {
      setIsGeneratingScript(false)
    }
  }

  // 이미지 생성
  const handleGenerateImages = async () => {
    if (scriptLines.length === 0) {
      alert("먼저 대본을 생성해주세요.")
      return
    }

    // 로컬스토리지에서 직접 가져오기
    const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("openai_api_key") || undefined : undefined
    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("replicate_api_key") || undefined : undefined

    if (!openaiApiKey || !replicateApiKey) {
      alert("API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
      return
    }

    setIsGeneratingImages(true)
    setGeneratedImages([])

    try {
      // 재시도 함수
      const generateImageWithRetry = async (
        prompt: string,
        replicateApiKey: string,
        maxRetries: number = 3
      ): Promise<string | null> => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            return await generateImageWithReplicate(prompt, replicateApiKey, "1:1", imageStyle, undefined)
          } catch (error) {
            console.error(`[Shorts] 재시도 ${attempt}/${maxRetries} 실패:`, error)
            if (attempt === maxRetries) {
              throw error
            }
            // 재시도 전 대기 (지수 백오프)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          }
        }
        return null
      }

      for (let i = 0; i < scriptLines.length; i++) {
        const line = scriptLines[i]
        console.log(`[Shorts] 이미지 생성 중: ${i + 1}/${scriptLines.length}`)

        // 이미 생성된 이미지는 건너뛰기
        const existingImage = generatedImages.find(img => img.lineId === line.id)
        if (existingImage) {
          console.log(`[Shorts] 이미지 건너뛰기 (이미 생성됨): 줄 ${line.id}`)
          continue
        }

        // 프롬프트 생성 (1:1 비율 강제)
        // custom 카테고리는 health로 대체, fortune(사주)도 health로 대체
        const categoryForPrompt = (selectedCategory === "custom" || selectedCategory === "fortune") ? "health" : (selectedCategory || "health")
        let prompt = await generateImagePrompt(line.text, openaiApiKey, categoryForPrompt)
        // 모든 비율 관련 텍스트 제거 및 1:1로 변경
        prompt = prompt.replace(/16:9/g, "")
        prompt = prompt.replace(/9:16/g, "")
        prompt = prompt.replace(/aspect ratio/g, "")
        prompt = prompt.replace(/vertical composition/g, "")
        prompt = prompt.replace(/portrait orientation/g, "")
        prompt = prompt.replace(/cinematic composition/g, "")
        // 인물 제거 (손, 사람 등)
        prompt = prompt.replace(/person|people|human|hand|hands|face|body|figure|man|woman|child|children/gi, "")
        // 1:1 비율 강제 추가 및 인물 제거 명시 (맨 끝에)
        const imagePrompt = `${prompt.trim()}, 1:1 aspect ratio, square composition, square format, no people, no person, no human, no hands, no faces, no body parts, landscape or object focused`

        try {
          // 이미지 생성 (1:1 비율 - Replicate API에 직접 전달)
          console.log(`[Shorts] 이미지 생성 - Aspect Ratio: 1:1, Prompt: ${imagePrompt.substring(0, 100)}...`)
          
          // 재시도 로직이 포함된 이미지 생성
          let imageUrl = await generateImageWithRetry(imagePrompt, replicateApiKey)
          
          // 이미지가 안 나오면 5초 더 기다렸다가 재시도
          if (!imageUrl) {
            console.log(`[Shorts] 이미지가 생성되지 않음, 5초 대기 후 재시도...`)
            await new Promise(resolve => setTimeout(resolve, 5000))
            
            // 한 번 더 시도
            try {
              imageUrl = await generateImageWithRetry(imagePrompt, replicateApiKey)
            } catch (retryError) {
              console.error(`[Shorts] 재시도 후에도 실패:`, retryError)
            }
          }
          
          if (imageUrl) {
            console.log(`[Shorts] 이미지 생성 완료: ${imageUrl}`)
            
            setGeneratedImages((prev) => {
              const newImages = [
                ...prev,
                {
                  lineId: line.id,
                  imageUrl,
                  prompt: imagePrompt,
                  order: prev.length, // 순서 추가
                  isUserUploaded: false,
                },
              ]
              // order 기준으로 정렬
              return newImages.sort((a, b) => a.order - b.order)
            })
          } else {
            console.warn(`[Shorts] 이미지 생성 실패 (줄 ${line.id}): 이미지 URL을 받지 못함`)
          }
        } catch (error) {
          console.error(`[Shorts] 이미지 생성 실패 (줄 ${line.id}):`, error)
          // 실패해도 계속 진행
        }
        
        // API 제한 방지를 위한 딜레이 (5~10초 랜덤 간격)
        if (i < scriptLines.length - 1) {
          const delay = Math.floor(Math.random() * 5000) + 5000 // 5000ms ~ 10000ms (5~10초)
          console.log(`[Shorts] ${delay}ms 대기 후 다음 이미지 생성...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      setActiveStep("image")
    } catch (error) {
      console.error("이미지 생성 실패:", error)
      alert("이미지 생성에 실패했습니다.")
    } finally {
      setIsGeneratingImages(false)
    }
  }

  // 목소리 미리듣기 함수
  const handlePreviewVoice = async (voiceId: string) => {
    setPreviewingVoiceId(voiceId)
    
    try {
      const isTTSMaker = voiceId?.startsWith("ttsmaker-")
      const isSupertone = voiceId?.startsWith("supertone-")
      const isElevenLabs = !isTTSMaker && !isSupertone
      
      let response: Response
      let apiKey: string | undefined = undefined
      let apiKeyName = ""
      
      if (isTTSMaker) {
        const voiceName = voiceId.replace("ttsmaker-", "")
        const pitch = voiceName === "남성5" ? 0.9 : 1.0
        apiKey = typeof window !== "undefined" ? localStorage.getItem("ttsmaker_api_key") || undefined : undefined
        apiKeyName = "TTSMaker API 키"
        
        if (!apiKey) {
          alert(`${apiKeyName}가 필요합니다. 설정에서 API 키를 입력해주세요.`)
          setPreviewingVoiceId(null)
          return
        }
        
        console.log(`[미리듣기] TTSMaker voice: ${voiceId} -> ${voiceName}, pitch: ${pitch}`)
        response = await fetch("/api/ttsmaker", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: "여러분 환영합니다",
            voice: voiceName,
            speed: 1.0,
            pitch: pitch,
            apiKey: apiKey,
          }),
        })
      } else if (isSupertone) {
        const supertoneVoiceId = voiceId.replace("supertone-", "")
        // 수퍼톤 API 키 가져오기
        let supertoneApiKey = typeof window !== "undefined" 
          ? (localStorage.getItem("supertone_api_key") || "").trim() 
          : null
        
        if (!supertoneApiKey || supertoneApiKey.length === 0) {
          const key = getApiKey("supertone_api_key")
          supertoneApiKey = key !== undefined ? key : null
        }
        
        apiKey = supertoneApiKey || undefined
        apiKeyName = "수퍼톤 API 키"
        
        if (!apiKey) {
          alert(`${apiKeyName}가 필요합니다. 설정에서 API 키를 입력해주세요.`)
          setPreviewingVoiceId(null)
          return
        }
        
        console.log(`[미리듣기] 수퍼톤 voice: ${voiceId} -> ${supertoneVoiceId}`)
        response = await fetch("/api/supertone-tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: "여러분 환영합니다",
            voiceId: supertoneVoiceId,
            apiKey: apiKey,
            style: "neutral",
            language: "ko",
          }),
        })
      } else {
        // ElevenLabs
        let elevenlabsApiKey = getApiKey("elevenlabs_api_key") ?? null
        
        if (!elevenlabsApiKey || elevenlabsApiKey.length === 0) {
          elevenlabsApiKey = typeof window !== "undefined" 
            ? (localStorage.getItem("elevenlabs_api_key") || "").trim() || null
            : null
        }
        
        apiKey = elevenlabsApiKey || undefined
        apiKeyName = "ElevenLabs API 키"
        
        if (!apiKey) {
          alert(`${apiKeyName}가 필요합니다. 설정에서 API 키를 입력해주세요.`)
          setPreviewingVoiceId(null)
          return
        }
        
        console.log(`[미리듣기] ElevenLabs voice: ${voiceId}`)
        response = await fetch("/api/elevenlabs-tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: "여러분 환영합니다",
            voiceId: voiceId,
            apiKey: apiKey,
          }),
        })
      }

      if (!response.ok) {
        let errorMessage = "미리듣기 실패"
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
      
      if (data.audioUrl) {
        setPreviewAudioUrl(data.audioUrl)
        const audio = new Audio(data.audioUrl)
        audio.play()
        audio.onended = () => {
          setPreviewingVoiceId(null)
          setPreviewAudioUrl(null)
        }
        audio.onerror = () => {
          setPreviewingVoiceId(null)
          setPreviewAudioUrl(null)
        }
      } else if (data.audioBase64) {
        const binaryString = atob(data.audioBase64)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        const blob = new Blob([bytes], { type: "audio/mpeg" })
        const audioUrl = URL.createObjectURL(blob)
        setPreviewAudioUrl(audioUrl)
        
        const audio = new Audio(audioUrl)
        audio.play()
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl)
          setPreviewingVoiceId(null)
          setPreviewAudioUrl(null)
        }
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl)
          setPreviewingVoiceId(null)
          setPreviewAudioUrl(null)
        }
      }
    } catch (error) {
      console.error("미리듣기 실패:", error)
      alert(`미리듣기에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
      setPreviewingVoiceId(null)
      setPreviewAudioUrl(null)
    }
  }

  // TTS 생성 (TTSMaker, 수퍼톤, ElevenLabs 지원)
  const handleGenerateTts = async () => {
    if (scriptLines.length === 0) {
      alert("생성된 문장 리스트가 없습니다. 먼저 대본을 생성해주세요.")
      return
    }

    // 선택된 목소리 타입 확인
    const isTTSMaker = selectedVoiceId?.startsWith("ttsmaker-")
    const isSupertone = selectedVoiceId?.startsWith("supertone-")
    const isElevenLabs = !isTTSMaker && !isSupertone

    // API 키 확인 및 가져오기
    let apiKey: string | undefined = undefined
    let apiKeyName = ""

    if (isTTSMaker) {
      apiKey = typeof window !== "undefined" ? localStorage.getItem("ttsmaker_api_key") || undefined : undefined
      apiKeyName = "TTSMaker API 키"
    } else if (isSupertone) {
      // 수퍼톤 API 키 가져오기 (롱폼과 동일한 방식)
      let supertoneApiKey = typeof window !== "undefined" 
        ? (localStorage.getItem("supertone_api_key") || "").trim() 
        : null
      
      if (!supertoneApiKey || supertoneApiKey.length === 0) {
        const key = getApiKey("supertone_api_key")
        supertoneApiKey = key !== undefined ? key : null
      }
      
      apiKey = supertoneApiKey || undefined
      apiKeyName = "수퍼톤 API 키"
    } else {
      // ElevenLabs
      let elevenlabsApiKey = getApiKey("elevenlabs_api_key") ?? null
      
      if (!elevenlabsApiKey || elevenlabsApiKey.length === 0) {
        elevenlabsApiKey = typeof window !== "undefined" 
          ? (localStorage.getItem("elevenlabs_api_key") || "").trim() || null
          : null
      }
      
      apiKey = elevenlabsApiKey || undefined
      apiKeyName = "ElevenLabs API 키"
    }

    if (!apiKey) {
      alert(`${apiKeyName}가 필요합니다. 메인 화면의 설정(톱니바퀴 아이콘)에서 API 키를 입력해주세요.`)
      return
    }

    console.log(`[Shorts] ${apiKeyName} 확인:`, apiKey ? "있음" : "없음")
    console.log(`[Shorts] 선택된 목소리: ${selectedVoiceId} (타입: ${isTTSMaker ? "TTSMaker" : isSupertone ? "수퍼톤" : "ElevenLabs"})`)

    setIsGeneratingTts(true)
    setTtsGenerationProgress({ current: 0, total: scriptLines.length })
    // 기존 오디오 초기화
    setGeneratedAudios([])

    let successCount = 0
    // 로컬 배열로 생성된 오디오 수집 (상태 업데이트 지연 문제 해결)
    const collectedAudios: Array<{ lineId: number; audioUrl?: string; audioBase64?: string }> = []

    try {
      for (let i = 0; i < scriptLines.length; i++) {
        const line = scriptLines[i]
        setTtsGenerationProgress({ current: i + 1, total: scriptLines.length })

        try {
          let response: Response
          
          if (isTTSMaker) {
            // TTSMaker API를 통해 TTS 생성
            const voiceName = selectedVoiceId.replace("ttsmaker-", "")
            const pitch = voiceName === "남성5" ? 0.9 : 1.0
            console.log(`[Shorts] TTSMaker TTS 생성 중... (${i + 1}/${scriptLines.length})`)
            
            response = await fetch("/api/ttsmaker", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                text: line.text,
                voice: voiceName,
                speed: 1.0,
                pitch: pitch,
                apiKey: apiKey,
              }),
            })
          } else if (isSupertone) {
            // 수퍼톤 API를 통해 TTS 생성
            const voiceId = selectedVoiceId.replace("supertone-", "")
            console.log(`[Shorts] 수퍼톤 TTS 생성 중... (${i + 1}/${scriptLines.length})`)
            
            response = await fetch("/api/supertone-tts", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                text: line.text,
                voiceId: voiceId,
                apiKey: apiKey,
                style: "neutral", // 기본 스타일
                language: "ko", // 한국어
              }),
            })
          } else {
            // ElevenLabs API를 통해 TTS 생성
            console.log(`[Shorts] ElevenLabs TTS 생성 중... (${i + 1}/${scriptLines.length})`)
            
            response = await fetch("/api/elevenlabs-tts", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                text: line.text,
                voiceId: selectedVoiceId,
                apiKey: apiKey,
              }),
            })
          }

          if (!response.ok) {
            let errorMessage = "TTS 생성 실패"
            try {
              const errorData = await response.json()
              errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`
            } catch (e) {
              const errorText = await response.text()
              errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`
            }
            console.error(`[Shorts] TTS API 오류 (줄 ${line.id}):`, errorMessage)
            throw new Error(errorMessage)
          }

          const data = await response.json()
          
          if (!data.audioBase64 && !data.audioUrl) {
            console.error(`[Shorts] TTS 응답에 오디오 데이터 없음 (줄 ${line.id}):`, data)
            throw new Error("TTS 응답에 오디오 데이터가 없습니다.")
          }
          
          console.log(`[Shorts] TTS 생성 완료 (줄 ${line.id}):`, data.audioUrl ? "URL 있음" : "URL 없음", data.audioBase64 ? "Base64 있음" : "Base64 없음")

          // 로컬 배열과 state 모두 업데이트
          const audioData = {
            lineId: line.id,
            audioUrl: data.audioUrl,
            audioBase64: data.audioBase64,
          }
          collectedAudios.push(audioData)
          setGeneratedAudios((prev) => [...prev, audioData])
          successCount++
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error(`[Shorts] TTS 생성 실패 (줄 ${line.id}):`, errorMessage)
          console.error(`[Shorts] 실패한 텍스트:`, line.text.substring(0, 50) + "...")
          // 실패해도 계속 진행하되, 사용자에게 알림
          if (i === 0) {
            // 첫 번째 실패 시에만 경고 (모든 실패는 마지막에 요약)
            console.warn(`[Shorts] 첫 번째 TTS 생성 실패. 계속 진행합니다...`)
          }
        }
      }

      console.log("[Shorts] 모든 TTS 생성 완료, 성공:", successCount, "개 / 전체:", scriptLines.length, "개")

      // TTS가 하나라도 생성되었으면 완료 표시
      if (successCount > 0) {
        if (successCount < scriptLines.length) {
          alert(`${successCount}개의 TTS가 생성되었습니다. (${scriptLines.length - successCount}개 실패)\n\n실패한 항목은 브라우저 콘솔을 확인해주세요.`)
        } else {
          alert(`${successCount}개의 TTS가 모두 생성되었습니다!`)
        }
        
        // 각 TTS 오디오의 실제 길이 측정 및 오디오 버퍼 저장
        console.log("[Shorts] 각 오디오의 실제 길이 측정 및 버퍼 저장 시작")
        const audioDurations: Array<{ lineId: number; duration: number; audioBuffer?: AudioBuffer }> = []
        const audioContextForAnalysis = new (window.AudioContext || (window as any).webkitAudioContext)()
        
        for (const line of scriptLines) {
          const audio = collectedAudios.find((a) => a.lineId === line.id)
          if (audio) {
            try {
              // AudioBuffer로 로드하여 정확한 duration 측정 및 버퍼 저장
              let audioUrl = audio.audioUrl
              if (audio.audioBase64 && !audioUrl) {
                audioUrl = `data:audio/mpeg;base64,${audio.audioBase64}`
              }
              
              if (audioUrl) {
                const audioResponse = await fetch(audioUrl)
                const audioArrayBuffer = await audioResponse.arrayBuffer()
                const audioBuffer = await audioContextForAnalysis.decodeAudioData(audioArrayBuffer)
                
                // 정확한 duration (샘플 수 / 샘플레이트)
                const preciseDuration = audioBuffer.duration
                
                audioDurations.push({
                  lineId: line.id,
                  duration: preciseDuration,
                  audioBuffer: audioBuffer, // 오디오 버퍼 저장 (자막 타이밍 계산용)
                })
                
                // generatedAudios에도 오디오 버퍼와 duration 추가
                setGeneratedAudios((prev) => {
                  const updated = prev.map((a) => 
                    a.lineId === line.id 
                      ? { ...a, audioBuffer, duration: preciseDuration }
                      : a
                  )
                  return updated
                })
                
                console.log(`[Shorts] 오디오 ${line.id} 정확한 길이: ${preciseDuration.toFixed(3)}초, 버퍼 저장 완료`)
              }
            } catch (error) {
              console.error(`[Shorts] 오디오 로드 실패 (줄 ${line.id}):`, error)
              // Fallback: AudioElement 사용
              try {
                let audioUrl = audio.audioUrl
                if (audio.audioBase64 && !audioUrl) {
                  audioUrl = `data:audio/mpeg;base64,${audio.audioBase64}`
                }
                if (audioUrl) {
                  const audioElement = new Audio(audioUrl)
                  await new Promise((resolve) => {
                    audioElement.addEventListener("loadedmetadata", () => {
                      audioDurations.push({
                        lineId: line.id,
                        duration: audioElement.duration,
                      })
                      resolve(null)
                    })
                    audioElement.addEventListener("error", () => {
                      console.warn(`[Shorts] 오디오 메타데이터 로드 실패 (줄 ${line.id}), 예상 시간 사용`)
                      // 예상 시간 사용 (fallback)
                      const estimatedDuration = line.text.length / 6.9
                      audioDurations.push({
                        lineId: line.id,
                        duration: estimatedDuration,
                      })
                      resolve(null)
                    })
                  })
                }
              } catch (fallbackError) {
                console.error(`[Shorts] Fallback 오디오 로드 실패 (줄 ${line.id}):`, fallbackError)
                // 예상 시간 사용
                const estimatedDuration = line.text.length / 6.9
                audioDurations.push({
                  lineId: line.id,
                  duration: estimatedDuration,
                })
              }
            }
          }
        }
        
        // scriptLines의 startTime, endTime을 실제 오디오 길이에 맞춰 업데이트
        console.log("[Shorts] scriptLines 타이밍 업데이트 시작")
        let currentTime = 0
        const updatedScriptLines = scriptLines.map((line) => {
          const audioDuration = audioDurations.find((d) => d.lineId === line.id)?.duration || 0
          const startTime = currentTime
          const endTime = currentTime + (audioDuration * 1000) // 밀리초로 변환
          
          if (audioDuration > 0) {
            currentTime += audioDuration * 1000
          } else {
            // 오디오가 없으면 예상 시간 사용
            const estimatedDuration = (line.text.length / 6.9) * 1000
            currentTime += estimatedDuration
          }
          
          return {
            ...line,
            startTime: startTime,
            endTime: endTime,
          }
        })
        
        setScriptLines(updatedScriptLines)
        console.log("[Shorts] scriptLines 타이밍 업데이트 완료")
        
        // 모든 오디오를 합치기 (로컬 배열 사용 - 상태 업데이트 지연 문제 해결)
        console.log("[Shorts] mergeAudios 호출, 수집된 오디오 개수:", collectedAudios.length)
        await mergeAudios(collectedAudios)
        
        // mergeAudios 완료 후 상태 확인
        console.log("[Shorts] mergeAudios 완료")
        
        setActiveStep("preview") // TTS 후 미리보기로 이동
      } else {
        const errorMessage = "TTS 생성에 실패했습니다.\n\n가능한 원인:\n1. TTSMaker API 키가 올바르지 않습니다\n2. API 키의 사용량이 초과되었습니다\n3. 네트워크 연결 문제\n\n브라우저 콘솔(F12)에서 자세한 오류를 확인해주세요."
        alert(errorMessage)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error("TTS 생성 실패:", errorMessage, error)
      alert(`TTS 생성 중 오류가 발생했습니다:\n\n${errorMessage}\n\n브라우저 콘솔(F12)에서 자세한 오류를 확인해주세요.`)
    } finally {
      setIsGeneratingTts(false)
      setTtsGenerationProgress({ current: 0, total: 0 })
    }
  }

  // 오디오 합치기 함수
  const mergeAudios = async (audios?: Array<{ lineId: number; audioUrl?: string; audioBase64?: string }>) => {
    const audiosToMerge = audios || generatedAudios
    if (audiosToMerge.length === 0) {
      console.warn("[Shorts] mergeAudios: 합칠 오디오가 없습니다")
      return
    }

    console.log("[Shorts] mergeAudios 시작, 오디오 개수:", audiosToMerge.length)

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const audioBuffers: AudioBuffer[] = []

      // 각 오디오를 로드
      for (const audio of audiosToMerge) {
        let audioUrl = audio.audioUrl
        if (audio.audioBase64 && !audioUrl) {
          audioUrl = `data:audio/mpeg;base64,${audio.audioBase64}`
        }
        if (!audioUrl) continue

        const response = await fetch(audioUrl)
        const arrayBuffer = await response.arrayBuffer()
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        audioBuffers.push(audioBuffer)
      }

      // 오디오 합치기
      const totalLength = audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0)
      const mergedBuffer = audioContext.createBuffer(
        audioBuffers[0].numberOfChannels,
        totalLength,
        audioBuffers[0].sampleRate
      )

      let offset = 0
      for (const buffer of audioBuffers) {
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          const mergedData = mergedBuffer.getChannelData(channel)
          const bufferData = buffer.getChannelData(channel)
          mergedData.set(bufferData, offset)
        }
        offset += buffer.length
      }

      // WAV로 변환
      const wav = audioBufferToWav(mergedBuffer)
      const blob = new Blob([wav], { type: "audio/wav" })
      const url = URL.createObjectURL(blob)
      console.log("[Shorts] 오디오 합치기 완료, URL 설정:", url.substring(0, 50) + "...")
      console.log("[Shorts] Blob 크기:", blob.size, "bytes")
      setTtsAudioUrl(url)
      console.log("[Shorts] ttsAudioUrl 상태 업데이트 완료, URL:", url)
    } catch (error) {
      console.error("오디오 합치기 실패:", error)
      throw error
    }
  }

  // AudioBuffer를 WAV로 변환하는 함수
  const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
    const length = buffer.length
    const numberOfChannels = buffer.numberOfChannels
    const sampleRate = buffer.sampleRate
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2)
    const view = new DataView(arrayBuffer)

    // WAV 헤더 작성
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }

    writeString(0, "RIFF")
    view.setUint32(4, 36 + length * numberOfChannels * 2, true)
    writeString(8, "WAVE")
    writeString(12, "fmt ")
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, numberOfChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * numberOfChannels * 2, true)
    view.setUint16(32, numberOfChannels * 2, true)
    view.setUint16(34, 16, true)
    writeString(36, "data")
    view.setUint32(40, length * numberOfChannels * 2, true)

    // PCM 데이터 작성
    let offset = 44
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]))
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
        offset += 2
      }
    }

    return arrayBuffer
  }

  // 미리보기 재생/정지
  const handlePreviewPlayPause = () => {
    console.log("[Preview] 재생 버튼 클릭", { 
      hasTtsAudio: !!ttsAudioUrl, 
      hasCanvas: !!canvasRef.current,
      isPlaying,
      ttsAudioUrl: ttsAudioUrl ? "있음" : "없음",
      generatedAudiosCount: generatedAudios.length,
      scriptLinesCount: scriptLines.length
    })
    
    if (!ttsAudioUrl) {
      console.error("[Preview] TTS 오디오 URL이 없습니다")
      alert("TTS 오디오가 없습니다. 먼저 TTS를 생성해주세요.")
      return
    }
    
    if (!canvasRef.current) {
      console.error("[Preview] 캔버스가 없습니다")
      alert("캔버스를 찾을 수 없습니다.")
      return
    }
    
    if (scriptLines.length === 0) {
      console.error("[Preview] 대본 라인이 없습니다")
      alert("대본이 없습니다.")
      return
    }
    
    if (generatedImages.length === 0) {
      console.error("[Preview] 생성된 이미지가 없습니다")
      alert("이미지가 없습니다.")
      return
    }

    if (isPlaying) {
      // 일시정지
      if (previewAudio) {
        previewAudio.pause()
        console.log("[Preview] 오디오 일시정지, 현재 시간:", previewAudio.currentTime)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      setIsPlaying(false)
      console.log("[Preview] 일시정지 완료")
    } else {
      // 재생 (일시정지 후 재개 또는 처음 재생)
      let audio = previewAudio
      
      if (!audio || audio.ended) {
        // 새로운 오디오 생성 (처음 재생이거나 오디오가 끝난 경우)
        audio = new Audio(ttsAudioUrl)
        audio.volume = volume
        setPreviewAudio(audio)
        console.log("[Preview] 새로운 오디오 생성")
      } else {
        // 기존 오디오 재사용 (일시정지 후 재개)
        audio.volume = volume
        console.log("[Preview] 기존 오디오 재사용, 현재 시간:", audio.currentTime)
      }
      
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        console.error("[Preview] Canvas context를 가져올 수 없습니다")
        return
      }
      
      const totalDuration = scriptLines[scriptLines.length - 1]?.endTime / 1000 || 0
      
      // 오디오의 timeupdate 이벤트로 현재 시간 동기화
      audio.addEventListener("timeupdate", () => {
        if (!audio.paused) {
          setCurrentTime(audio.currentTime)
        }
      })

      // 이미지 미리 로드
      const images: HTMLImageElement[] = []
      const imagePromises = generatedImages.map((img) => {
        return new Promise<HTMLImageElement>((resolve) => {
          const imgEl = new Image()
          imgEl.crossOrigin = "anonymous"
          imgEl.onload = () => resolve(imgEl)
          imgEl.onerror = () => resolve(imgEl) // 실패해도 계속 진행
          imgEl.src = img.imageUrl
        })
      })

      Promise.all(imagePromises).then((loadedImages) => {
        // order 기준으로 정렬된 이미지 순서대로 로드
        const sortedImages = [...generatedImages].sort((a, b) => a.order - b.order)
        const sortedLoadedImages = sortedImages.map((img) => {
          const originalIndex = generatedImages.findIndex((orig) => orig.lineId === img.lineId && orig.imageUrl === img.imageUrl)
          return loadedImages[originalIndex]
        })
        images.push(...sortedLoadedImages)

        // 렌더링 함수 정의
        const renderFrame = () => {
          // 오디오가 없거나 정지된 경우
          if (!audio || audio.paused) {
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current)
              animationFrameRef.current = null
            }
            if (audio && audio.paused) {
              setIsPlaying(false)
            }
            return
          }

          const elapsed = audio.currentTime

          // 캔버스 초기화
          ctx.fillStyle = "black"
          ctx.fillRect(0, 0, canvas.width, canvas.height)

          // 제목 그리기 (위쪽 고정 - 두 줄로 표시, 각 줄 5-6자)
          if (hookingTitle) {
            const line1 = hookingTitle.line1 || ""
            const line2 = hookingTitle.line2 || ""
            
            // 제목 영역 높이 (두 줄, 간격 증가)
            const lineHeight = 100 // 줄 간격 증가 (80 -> 100)
            const topMargin = 80 // 위쪽 여백 증가 (40 -> 80)
            const totalTitleHeight = 200 + topMargin + 20 // 두 줄 + 여백 + 위쪽 여백 + 추가 간격
            
            ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
            ctx.fillRect(0, 0, canvas.width, totalTitleHeight)
            
            // 텍스트가 잘리지 않도록 폰트 크기 동적 조정
            const maxWidth = canvas.width * 0.9 // 캔버스 너비의 90%를 최대 너비로 설정
            let fontSize = 96
            ctx.font = `bold ${fontSize}px Arial`
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            
            // line1 폰트 크기 조정
            let line1Metrics = ctx.measureText(line1)
            while (line1Metrics.width > maxWidth && fontSize > 40) {
              fontSize -= 2
              ctx.font = `bold ${fontSize}px Arial`
              line1Metrics = ctx.measureText(line1)
            }
            
            // 첫 번째 줄: 노란색 (위쪽 여백 추가)
            ctx.fillStyle = "yellow"
            ctx.fillText(line1, canvas.width / 2, 50 + topMargin) // 50 -> 130
            
            // line2 폰트 크기 조정 (line1과 동일한 크기 사용)
            const line2Metrics = ctx.measureText(line2)
            if (line2Metrics.width > maxWidth) {
              let fontSize2 = fontSize
              while (ctx.measureText(line2).width > maxWidth && fontSize2 > 40) {
                fontSize2 -= 2
                ctx.font = `bold ${fontSize2}px Arial`
              }
            }
            
            // 두 번째 줄: 흰색 (간격 증가)
            ctx.fillStyle = "white"
            ctx.fillText(line2, canvas.width / 2, 50 + topMargin + lineHeight) // 130 + 100 = 230
          } else if (selectedTopic) {
            // hookingTitle이 없으면 원본 제목 표시 (하위 호환성)
            ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
            ctx.fillRect(0, 0, canvas.width, 100)
            ctx.fillStyle = "yellow"
            ctx.font = "bold 48px Arial"
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            ctx.fillText(selectedTopic, canvas.width / 2, 50)
          }

          // 현재 시간에 맞는 이미지 찾기 (order 기준으로 순서대로 사용)
          const sortedImages = [...generatedImages].sort((a, b) => a.order - b.order)
          const currentLine = scriptLines.find(
            (line) => elapsed >= line.startTime / 1000 && elapsed <= line.endTime / 1000
          ) || scriptLines[scriptLines.length - 1] // 없으면 마지막 라인 사용

          if (currentLine) {
            // 현재 라인의 인덱스 찾기
            const currentLineIndex = scriptLines.findIndex((line) => line.id === currentLine.id)
            
            // 순서대로 이미지 사용: 라인 인덱스를 이미지 인덱스로 매핑 (순환)
            let imageIndex = currentLineIndex % sortedImages.length
            
            // 이미지가 있으면 표시 (줌인 효과 제거)
            if (imageIndex >= 0 && imageIndex < images.length && images[imageIndex]) {
              const img = images[imageIndex]
              // 좌우 공백 없이 꽉 차게 표시
              const imageWidth = canvas.width // 좌우 꽉 차게
              const imageHeight = canvas.width // 1:1 비율 유지 (너비와 동일)
              const imageX = 0 // 좌측부터 시작
              // 제목 영역 높이 (두 줄)
              const titleHeight = hookingTitle ? 300 : 100 // 200 + 80 (위쪽 여백) + 20 (추가 간격)
              const imageY = titleHeight + 30 // 제목 밑에 30px 여백 추가

              // 1:1 이미지인 경우 그대로 표시, 아닌 경우 중앙 크롭
              if (img.width === img.height) {
                // 정확히 1:1인 경우 그대로 표시
                ctx.drawImage(
                  img,
                  0, 0, img.width, img.height, // 소스: 전체 이미지
                  imageX, imageY, imageWidth, imageHeight // 대상: 좌우 꽉 차게 표시
                )
              } else {
                // 1:1이 아닌 경우, 중앙에서 1:1 영역만 크롭하여 표시
                const sourceSize = Math.min(img.width, img.height)
                const sourceX = (img.width - sourceSize) / 2
                const sourceY = (img.height - sourceSize) / 2
                
                ctx.drawImage(
                  img,
                  sourceX, sourceY, sourceSize, sourceSize, // 소스: 중앙 1:1 영역
                  imageX, imageY, imageWidth, imageHeight // 대상: 좌우 꽉 차게 표시
                )
              }
            } else if (images.length > 0) {
              // 이미지가 하나도 매칭되지 않으면 마지막 이미지 표시
              const lastImg = images[images.length - 1]
              const imageWidth = canvas.width
              const imageHeight = canvas.width
              const imageX = 0
              const titleHeight = hookingTitle ? 300 : 100
              const imageY = titleHeight + 30

              if (lastImg.width === lastImg.height) {
                // 정확히 1:1인 경우 그대로 표시
                ctx.drawImage(
                  lastImg,
                  0, 0, lastImg.width, lastImg.height,
                  imageX, imageY, imageWidth, imageHeight
                )
              } else {
                // 1:1이 아닌 경우, 중앙에서 1:1 영역만 크롭하여 표시
                const sourceSize = Math.min(lastImg.width, lastImg.height)
                const sourceX = (lastImg.width - sourceSize) / 2
                const sourceY = (lastImg.height - sourceSize) / 2
                
                ctx.drawImage(
                  lastImg,
                  sourceX, sourceY, sourceSize, sourceSize,
                  imageX, imageY, imageWidth, imageHeight
                )
              }
            }
          }

          // 자막 그리기 (아래쪽 - 한 줄씩만 표시)
          if (currentLine) {
            const subtitleText = currentLine.text
            // 자막 폰트 설정
            ctx.font = "bold 60px Arial"
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            
            // 화면 너비에 맞춰 자막 나누기 (좌우 여백 40px)
            const maxWidth = canvas.width - 80
            const lines: string[] = []
            const words = subtitleText.split(" ")
            let currentLineText = ""
            
            for (const word of words) {
              const testText = currentLineText ? `${currentLineText} ${word}` : word
              const textWidth = ctx.measureText(testText).width
              
              if (textWidth <= maxWidth) {
                currentLineText = testText
              } else {
                if (currentLineText) {
                  lines.push(currentLineText)
                }
                // 단어가 너무 길면 강제로 자르기
                if (ctx.measureText(word).width > maxWidth) {
                  // 단어를 문자 단위로 나누기
                  let charLine = ""
                  for (const char of word) {
                    const testChar = charLine + char
                    if (ctx.measureText(testChar).width <= maxWidth) {
                      charLine = testChar
                    } else {
                      if (charLine) lines.push(charLine)
                      charLine = char
                    }
                  }
                  currentLineText = charLine
                } else {
                  currentLineText = word
                }
              }
            }
            if (currentLineText) lines.push(currentLineText)

            // 오디오 버퍼 기반으로 정확한 자막 타이밍 계산
            const audioData = generatedAudios.find((a) => a.lineId === currentLine.id)
            const audioBuffer = audioData?.audioBuffer
            const audioDuration = audioData?.duration || ((currentLine.endTime - currentLine.startTime) / 1000)
            
            // splitIntoSubtitleLines 함수 (롱폼과 동일)
            const splitIntoSubtitleLines = (text: string, audioBuffer?: AudioBuffer, totalDuration: number = 0): Array<{ text: string; startTime: number; endTime: number }> => {
              const words = text.split(" ").filter(w => w.trim().length > 0)
              if (words.length === 0) return [{ text, startTime: 0, endTime: totalDuration }]
              
              const result: Array<{ text: string; startTime: number; endTime: number }> = []
              
              // 각 단어의 예상 시작 시간 계산 (단어 길이 기반)
              let wordStartTimes: number[] = []
              if (audioBuffer && totalDuration > 0) {
                const totalChars = words.reduce((sum, w) => sum + w.length, 0)
                let currentTime = 0
                
                for (const word of words) {
                  const wordRatio = word.length / totalChars
                  const wordDuration = wordRatio * totalDuration
                  wordStartTimes.push(currentTime)
                  currentTime += wordDuration
                }
              } else {
                // Fallback: 균등 분배
                const timePerWord = totalDuration / words.length
                for (let i = 0; i < words.length; i++) {
                  wordStartTimes.push(i * timePerWord)
                }
              }
              
              // 단어들을 묶어서 자막 라인 생성 (화면 너비에 맞춰)
              let currentSubtitleLine: string[] = []
              let lineStartTime = 0
              
              for (let i = 0; i < words.length; i++) {
                const word = words[i]
                const testLine = currentSubtitleLine.length > 0 ? currentSubtitleLine.join(" ") + " " + word : word
                const textWidth = ctx.measureText(testLine).width
                
                // 화면 너비를 초과하면 줄 분리
                if (textWidth > maxWidth && currentSubtitleLine.length >= 1) {
                  if (currentSubtitleLine.length > 0) {
                    const lineEndTime = i < wordStartTimes.length ? wordStartTimes[i] : totalDuration
                    result.push({
                      text: currentSubtitleLine.join(" "),
                      startTime: lineStartTime,
                      endTime: lineEndTime,
                    })
                  }
                  currentSubtitleLine = [word]
                  lineStartTime = wordStartTimes[i] || (i * (totalDuration / words.length))
                } else {
                  currentSubtitleLine.push(word)
                }
              }
              
              // 마지막 줄 처리
              if (currentSubtitleLine.length > 0) {
                result.push({
                  text: currentSubtitleLine.join(" "),
                  startTime: lineStartTime,
                  endTime: totalDuration,
                })
              }
              
              return result.length > 0 ? result : [{ text, startTime: 0, endTime: totalDuration }]
            }
            
            // 오디오 버퍼 기반으로 자막 라인 생성
            const subtitleLines = splitIntoSubtitleLines(subtitleText, audioBuffer, audioDuration)
            
            // 현재 시간에 맞는 자막 라인 찾기
            const timeInLine = elapsed - (currentLine.startTime / 1000)
            const currentSubtitleLine = subtitleLines.find(
              (line) => timeInLine >= line.startTime && timeInLine <= line.endTime
            ) || subtitleLines[0] || { text: subtitleText, startTime: 0, endTime: audioDuration }
            
            const displayLine = currentSubtitleLine.text

            // 자막 배경 (한 줄만 표시하므로 고정 높이)
            const subtitleHeight = 100
            ctx.fillStyle = "rgba(0, 0, 0, 0.75)"
            ctx.fillRect(0, canvas.height - subtitleHeight - 250, canvas.width, subtitleHeight) // 50 -> 250으로 더 위로 이동

            // 자막 텍스트 (한 줄만 표시, 화면 너비 확인)
            ctx.fillStyle = "white"
            // 텍스트가 여전히 너무 길면 자르기
            let finalText = displayLine
            if (ctx.measureText(finalText).width > maxWidth) {
              // 텍스트를 자르고 "..." 추가
              while (ctx.measureText(finalText + "...").width > maxWidth && finalText.length > 0) {
                finalText = finalText.slice(0, -1)
              }
              finalText = finalText + "..."
            }
            ctx.fillText(finalText, canvas.width / 2, canvas.height - 250 - 50) // 50 -> 250으로 더 위로 이동
          }

          if (elapsed < totalDuration && !audio.paused) {
            animationFrameRef.current = requestAnimationFrame(renderFrame)
          } else {
            setIsPlaying(false)
            audio.pause()
            audio.currentTime = 0
            setCurrentTime(0)
          }
        }

        // 오디오 재생 시작 (에러 처리)
        audio.play().then(() => {
          setIsPlaying(true)
          console.log("[Preview] 오디오 재생 시작")
          renderFrame()
        }).catch((error) => {
          console.error("[Preview] 오디오 재생 실패:", error)
          alert("오디오 재생에 실패했습니다. 브라우저 콘솔을 확인해주세요.")
          setIsPlaying(false)
        })
      })

      audio.onended = () => {
        setIsPlaying(false)
        setCurrentTime(0)
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
      }
    }
  }

  // 미리보기 초기화 및 자동 제목 생성
  useEffect(() => {
    if (activeStep === "preview" && canvasRef.current) {
      // 자동으로 후킹 제목 생성 (아직 생성되지 않았고, 대본이 있는 경우 - 대본 기반)
      if (!hookingTitle && script && script.trim().length > 0) {
        const generateTitle = async () => {
          try {
            const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("openai_api_key") || undefined : undefined
            if (openaiApiKey) {
              console.log("[Shorts] 미리보기 진입 - 자동 제목 생성 시작 (대본 기반)")
              // 대본의 앞부분을 요약으로 사용 (주제 대신 대본 요약 사용)
              const scriptSummary = script.substring(0, 200).replace(/\n/g, " ").trim()
              const topicToUse = scriptSummary.length > 100 
                ? scriptSummary.substring(0, 100) + "..." 
                : scriptSummary
              const title = await generateShortsHookingTitle(topicToUse, script, openaiApiKey)
              console.log("[Shorts] 자동 생성된 제목:", title)
              setHookingTitle(title)
            }
          } catch (error) {
            console.error("[Shorts] 자동 제목 생성 실패:", error)
          }
        }
        generateTitle()
      }
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        console.error("[Preview] Canvas context를 가져올 수 없습니다")
        return
      }

      // 캔버스 크기 설정
      canvas.width = 1080
      canvas.height = 1920 // 9:16 비율

      console.log("[Preview] 미리보기 초기화 시작", {
        hasTtsAudio: !!ttsAudioUrl,
        imageCount: generatedImages.length,
        scriptLineCount: scriptLines.length,
        selectedTopic
      })

      // 초기 프레임 그리기 함수
      const drawInitialFrame = () => {
        // 검은 배경
        ctx.fillStyle = "black"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // 제목 그리기 (위쪽 고정 - 두 줄로 표시, 각 줄 5-6자)
        if (hookingTitle) {
          const line1 = hookingTitle.line1 || ""
          const line2 = hookingTitle.line2 || ""
          
          // 제목 영역 높이 (두 줄, 간격 증가)
          const lineHeight = 100 // 줄 간격 증가 (80 -> 100)
          const topMargin = 80 // 위쪽 여백
          const totalTitleHeight = 200 + topMargin + 20 // 두 줄 + 여백 + 위쪽 여백 + 추가 간격
          
          ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
          ctx.fillRect(0, 0, canvas.width, totalTitleHeight)
          
          // 텍스트가 잘리지 않도록 폰트 크기 동적 조정
          const maxWidth = canvas.width * 0.9 // 캔버스 너비의 90%를 최대 너비로 설정
          let fontSize = 96
          ctx.font = `bold ${fontSize}px Arial`
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"
          
          // line1 폰트 크기 조정
          let line1Metrics = ctx.measureText(line1)
          while (line1Metrics.width > maxWidth && fontSize > 40) {
            fontSize -= 2
            ctx.font = `bold ${fontSize}px Arial`
            line1Metrics = ctx.measureText(line1)
          }
          
          // 첫 번째 줄: 노란색 (위쪽 여백 추가)
          ctx.fillStyle = "yellow"
          ctx.fillText(line1, canvas.width / 2, 50 + topMargin) // 50 -> 130
          
          // line2 폰트 크기 조정 (line1과 동일한 크기 사용)
          const line2Metrics = ctx.measureText(line2)
          if (line2Metrics.width > maxWidth) {
            let fontSize2 = fontSize
            while (ctx.measureText(line2).width > maxWidth && fontSize2 > 40) {
              fontSize2 -= 2
              ctx.font = `bold ${fontSize2}px Arial`
            }
          }
          
          // 두 번째 줄: 흰색 (간격 증가)
          ctx.fillStyle = "white"
          ctx.fillText(line2, canvas.width / 2, 50 + topMargin + lineHeight) // 130 + 100 = 230
        } else if (selectedTopic) {
          // hookingTitle이 없으면 원본 제목 표시 (재생 중과 동일한 스타일)
          const lineHeight = 100
          const topMargin = 80
          const totalTitleHeight = 200 + topMargin + 20
          
          ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
          ctx.fillRect(0, 0, canvas.width, totalTitleHeight)
          ctx.fillStyle = "yellow"
          ctx.font = "bold 96px Arial"
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"
          // 원본 제목을 두 줄로 나누기 (최대 6자씩)
          const words = selectedTopic.split(" ")
          let line1 = ""
          let line2 = ""
          for (const word of words) {
            if (line1.length + word.length <= 6) {
              line1 += (line1 ? " " : "") + word
            } else if (line2.length + word.length <= 6) {
              line2 += (line2 ? " " : "") + word
            } else {
              break
            }
          }
          if (!line1) line1 = selectedTopic.substring(0, 6)
          if (!line2) line2 = selectedTopic.substring(6, 12) || ""
          
          ctx.fillText(line1, canvas.width / 2, 50 + topMargin)
          if (line2) {
            ctx.fillStyle = "white"
            ctx.fillText(line2, canvas.width / 2, 50 + topMargin + lineHeight)
          }
        }

        // 첫 번째 이미지가 있으면 로드
        if (generatedImages.length > 0) {
          const firstImage = new Image()
          firstImage.crossOrigin = "anonymous"
          
          firstImage.onload = () => {
            console.log("[Preview] 이미지 로드 완료", firstImage.width, firstImage.height)
            // 다시 그리기 (이미지 로드 후)
            ctx.fillStyle = "black"
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            // 제목 다시 그리기 (두 줄로 표시, 각 줄 5-6자)
            if (hookingTitle) {
              const line1 = hookingTitle.line1 || ""
              const line2 = hookingTitle.line2 || ""
              
              // 제목 영역 높이 (두 줄, 간격 증가)
              const lineHeight = 100 // 줄 간격 증가 (80 -> 100)
              const topMargin = 80 // 위쪽 여백
              const totalTitleHeight = 200 + topMargin + 20 // 두 줄 + 여백 + 위쪽 여백 + 추가 간격
              
              ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
              ctx.fillRect(0, 0, canvas.width, totalTitleHeight)
              
              // 텍스트가 잘리지 않도록 폰트 크기 동적 조정
              const maxWidth = canvas.width * 0.9 // 캔버스 너비의 90%를 최대 너비로 설정
              let fontSize = 96
              ctx.font = `bold ${fontSize}px Arial`
              ctx.textAlign = "center"
              ctx.textBaseline = "middle"
              
              // line1 폰트 크기 조정
              let line1Metrics = ctx.measureText(line1)
              while (line1Metrics.width > maxWidth && fontSize > 40) {
                fontSize -= 2
                ctx.font = `bold ${fontSize}px Arial`
                line1Metrics = ctx.measureText(line1)
              }
              
              // 첫 번째 줄: 노란색 (위쪽 여백 추가)
              ctx.fillStyle = "yellow"
              ctx.fillText(line1, canvas.width / 2, 50 + topMargin) // 50 -> 130
              
              // line2 폰트 크기 조정 (line1과 동일한 크기 사용)
              const line2Metrics = ctx.measureText(line2)
              if (line2Metrics.width > maxWidth) {
                let fontSize2 = fontSize
                while (ctx.measureText(line2).width > maxWidth && fontSize2 > 40) {
                  fontSize2 -= 2
                  ctx.font = `bold ${fontSize2}px Arial`
                }
              }
              
              // 두 번째 줄: 흰색 (간격 증가)
              ctx.fillStyle = "white"
              ctx.fillText(line2, canvas.width / 2, 50 + topMargin + lineHeight) // 130 + 100 = 230
            } else if (selectedTopic) {
              // hookingTitle이 없으면 원본 제목 표시 (재생 중과 동일한 스타일)
              const lineHeight = 100
              const topMargin = 80
              const totalTitleHeight = 200 + topMargin + 20
              
              ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
              ctx.fillRect(0, 0, canvas.width, totalTitleHeight)
              ctx.fillStyle = "yellow"
              ctx.font = "bold 96px Arial"
              ctx.textAlign = "center"
              ctx.textBaseline = "middle"
              // 원본 제목을 두 줄로 나누기 (최대 6자씩)
              const words = selectedTopic.split(" ")
              let line1 = ""
              let line2 = ""
              for (const word of words) {
                if (line1.length + word.length <= 6) {
                  line1 += (line1 ? " " : "") + word
                } else if (line2.length + word.length <= 6) {
                  line2 += (line2 ? " " : "") + word
                } else {
                  break
                }
              }
              if (!line1) line1 = selectedTopic.substring(0, 6)
              if (!line2) line2 = selectedTopic.substring(6, 12) || ""
              
              ctx.fillText(line1, canvas.width / 2, 50 + topMargin)
              if (line2) {
                ctx.fillStyle = "white"
                ctx.fillText(line2, canvas.width / 2, 50 + topMargin + lineHeight)
              }
            }

            // 좌우 공백 없이 꽉 차게 표시
            const imageWidth = canvas.width // 좌우 꽉 차게
            const imageHeight = canvas.width // 1:1 비율 유지 (너비와 동일)
            const imageX = 0 // 좌측부터 시작
            // 제목 영역 높이 (간격 증가로 인해 높이 증가, 위쪽 여백 포함)
            const titleHeight = hookingTitle ? 300 : 100 // 200 + 80 (위쪽 여백) + 20 (추가 간격)
            const imageY = titleHeight + 30 // 제목 밑에 30px 여백 추가
            
            // 이미지가 1:1이 아니면 중앙에서 1:1 영역만 표시
            if (firstImage.width === firstImage.height) {
              // 정확히 1:1인 경우
              ctx.drawImage(firstImage, imageX, imageY, imageWidth, imageHeight)
            } else {
              // 1:1이 아닌 경우, 중앙에서 1:1 영역만 크롭하여 표시
              const sourceSize = Math.min(firstImage.width, firstImage.height)
              const sourceX = (firstImage.width - sourceSize) / 2
              const sourceY = (firstImage.height - sourceSize) / 2
              ctx.drawImage(
                firstImage,
                sourceX, sourceY, sourceSize, sourceSize, // 소스: 중앙에서 1:1 영역
                imageX, imageY, imageWidth, imageHeight // 대상: 좌우 꽉 차게 표시
              )
            }

            // 첫 번째 자막 그리기 (아래쪽 - 한 줄만 표시)
            if (scriptLines.length > 0) {
              const firstLine = scriptLines[0]
              if (firstLine) {
                const subtitleText = firstLine.text
                // 자막 폰트 설정
                ctx.font = "bold 60px Arial"
                ctx.textAlign = "center"
                ctx.textBaseline = "middle"
                
                // 화면 너비에 맞춰 자막 나누기 (좌우 여백 40px)
                const maxWidth = canvas.width - 80
                const lines: string[] = []
                const words = subtitleText.split(" ")
                let currentLineText = ""
                
                for (const word of words) {
                  const testText = currentLineText ? `${currentLineText} ${word}` : word
                  const textWidth = ctx.measureText(testText).width
                  
                  if (textWidth <= maxWidth) {
                    currentLineText = testText
                  } else {
                    if (currentLineText) {
                      lines.push(currentLineText)
                    }
                    // 단어가 너무 길면 강제로 자르기
                    if (ctx.measureText(word).width > maxWidth) {
                      // 단어를 문자 단위로 나누기
                      let charLine = ""
                      for (const char of word) {
                        const testChar = charLine + char
                        if (ctx.measureText(testChar).width <= maxWidth) {
                          charLine = testChar
                        } else {
                          if (charLine) lines.push(charLine)
                          charLine = char
                        }
                      }
                      currentLineText = charLine
                    } else {
                      currentLineText = word
                    }
                  }
                }
                if (currentLineText) lines.push(currentLineText)

                // 첫 번째 줄만 표시
                let displayLine = lines[0] || ""

                // 자막 배경 (한 줄만 표시하므로 고정 높이)
                const subtitleHeight = 100
                ctx.fillStyle = "rgba(0, 0, 0, 0.75)"
                ctx.fillRect(0, canvas.height - subtitleHeight - 250, canvas.width, subtitleHeight) // 50 -> 250으로 더 위로 이동

                // 자막 텍스트 (한 줄만 표시, 화면 너비 확인)
                ctx.fillStyle = "white"
                // 텍스트가 여전히 너무 길면 자르기
                if (ctx.measureText(displayLine).width > maxWidth) {
                  // 텍스트를 자르고 "..." 추가
                  while (ctx.measureText(displayLine + "...").width > maxWidth && displayLine.length > 0) {
                    displayLine = displayLine.slice(0, -1)
                  }
                  displayLine = displayLine + "..."
                }
                ctx.fillText(displayLine, canvas.width / 2, canvas.height - 250 - 50) // 50 -> 250으로 더 위로 이동
              }
            }
          }
          
          firstImage.onerror = (error) => {
            console.error("[Preview] 이미지 로드 실패:", generatedImages[0]?.imageUrl, error)
            // 이미지 로드 실패해도 제목과 자막은 표시
            drawInitialFrame()
          }
          
          firstImage.src = generatedImages[0].imageUrl
        } else {
          // 이미지가 없어도 제목과 자막은 표시 (한 줄만 표시)
          if (scriptLines.length > 0) {
            const firstLine = scriptLines[0]
            if (firstLine) {
              const subtitleText = firstLine.text
              // 자막 폰트 설정
              ctx.font = "bold 60px Arial"
              ctx.textAlign = "center"
              ctx.textBaseline = "middle"
              
              // 화면 너비에 맞춰 자막 나누기 (좌우 여백 40px)
              const maxWidth = canvas.width - 80
              const lines: string[] = []
              const words = subtitleText.split(" ")
              let currentLineText = ""
              
              for (const word of words) {
                const testText = currentLineText ? `${currentLineText} ${word}` : word
                const textWidth = ctx.measureText(testText).width
                
                if (textWidth <= maxWidth) {
                  currentLineText = testText
                } else {
                  if (currentLineText) {
                    lines.push(currentLineText)
                  }
                  // 단어가 너무 길면 강제로 자르기
                  if (ctx.measureText(word).width > maxWidth) {
                    // 단어를 문자 단위로 나누기
                    let charLine = ""
                    for (const char of word) {
                      const testChar = charLine + char
                      if (ctx.measureText(testChar).width <= maxWidth) {
                        charLine = testChar
                      } else {
                        if (charLine) lines.push(charLine)
                        charLine = char
                      }
                    }
                    currentLineText = charLine
                  } else {
                    currentLineText = word
                  }
                }
              }
              if (currentLineText) lines.push(currentLineText)

              // 첫 번째 줄만 표시
              let displayLine = lines[0] || ""

              // 자막 배경 (한 줄만 표시하므로 고정 높이)
              const subtitleHeight = 100
              ctx.fillStyle = "rgba(0, 0, 0, 0.75)"
              ctx.fillRect(0, canvas.height - subtitleHeight - 250, canvas.width, subtitleHeight) // 50 -> 250으로 더 위로 이동

              // 자막 텍스트 (한 줄만 표시, 화면 너비 확인)
              ctx.fillStyle = "white"
              // 텍스트가 여전히 너무 길면 자르기
              if (ctx.measureText(displayLine).width > maxWidth) {
                // 텍스트를 자르고 "..." 추가
                while (ctx.measureText(displayLine + "...").width > maxWidth && displayLine.length > 0) {
                  displayLine = displayLine.slice(0, -1)
                }
                displayLine = displayLine + "..."
              }
              ctx.fillText(displayLine, canvas.width / 2, canvas.height - 150 - 50)
            }
          }
        }
      }

      // 초기 프레임 그리기
      drawInitialFrame()
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (previewAudio) {
        previewAudio.pause()
        previewAudio.currentTime = 0
      }
    }
  }, [activeStep, ttsAudioUrl, selectedTopic, generatedImages, scriptLines, hookingTitle])

  // 제목 미리보기 그리기
  useEffect(() => {
    if (!titlePreviewCanvasRef.current || !hookingTitle || generatedImages.length === 0) {
      return
    }

    const canvas = titlePreviewCanvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // 캔버스 크기 설정 (9:16 비율)
    canvas.width = 1080
    canvas.height = 1920

    // 배경 초기화
    ctx.fillStyle = "black"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 제목 그리기 (미리보기와 동일한 스타일)
    const line1 = hookingTitle.line1 || ""
    const line2 = hookingTitle.line2 || ""
    
    const lineHeight = 100
    const topMargin = 80
    const totalTitleHeight = 200 + topMargin + 20
    
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
    ctx.fillRect(0, 0, canvas.width, totalTitleHeight)
    
    const maxWidth = canvas.width * 0.9
    let fontSize = 96
    ctx.font = `bold ${fontSize}px Arial`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    
    // line1 폰트 크기 조정
    let line1Metrics = ctx.measureText(line1)
    while (line1Metrics.width > maxWidth && fontSize > 40) {
      fontSize -= 2
      ctx.font = `bold ${fontSize}px Arial`
      line1Metrics = ctx.measureText(line1)
    }
    
    // 첫 번째 줄: 노란색
    ctx.fillStyle = "yellow"
    ctx.fillText(line1, canvas.width / 2, 50 + topMargin)
    
    // line2 폰트 크기 조정
    const line2Metrics = ctx.measureText(line2)
    if (line2Metrics.width > maxWidth) {
      let fontSize2 = fontSize
      while (ctx.measureText(line2).width > maxWidth && fontSize2 > 40) {
        fontSize2 -= 2
        ctx.font = `bold ${fontSize2}px Arial`
      }
    }
    
    // 두 번째 줄: 흰색
    ctx.fillStyle = "white"
    ctx.fillText(line2, canvas.width / 2, 50 + topMargin + lineHeight)

    // 첫 번째 이미지 로드 및 표시
    const firstImage = new Image()
    firstImage.crossOrigin = "anonymous"
    firstImage.onload = () => {
      const titleHeight = 300
      const imageY = titleHeight + 30
      const imageWidth = canvas.width
      const imageHeight = canvas.width

      if (firstImage.width === firstImage.height) {
        ctx.drawImage(firstImage, 0, imageY, imageWidth, imageHeight)
      } else {
        const sourceSize = Math.min(firstImage.width, firstImage.height)
        const sourceX = (firstImage.width - sourceSize) / 2
        const sourceY = (firstImage.height - sourceSize) / 2
        ctx.drawImage(
          firstImage,
          sourceX, sourceY, sourceSize, sourceSize,
          0, imageY, imageWidth, imageHeight
        )
      }
    }
    firstImage.onerror = () => {
      console.error("[제목 미리보기] 이미지 로드 실패:", generatedImages[0]?.imageUrl)
    }
    firstImage.src = generatedImages[0].imageUrl
  }, [hookingTitle, generatedImages])

  // 영상 렌더링 (MediaRecorder 사용 - 미리보기 그대로 다운로드)
  const handleRenderVideo = async () => {
    if (generatedImages.length === 0 || !ttsAudioUrl || !canvasRef.current) {
      alert("이미지와 TTS가 모두 준비되어야 합니다.")
      return
    }

    setIsRendering(true)
    try {
      console.log("[Shorts] MediaRecorder 렌더링 시작")

      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        throw new Error("Canvas context를 생성할 수 없습니다.")
      }

      // 오디오 로드
      const audioResponse = await fetch(ttsAudioUrl)
      const audioBlob = await audioResponse.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      
      await new Promise<void>((resolve, reject) => {
        audio.onloadeddata = () => resolve()
        audio.onerror = reject
      })

      // 실제 오디오 길이 측정
      const actualAudioDuration = audio.duration
      const actualDurationMinutes = actualAudioDuration / 60
      console.log("[Shorts] 실제 오디오 길이:", actualAudioDuration.toFixed(3), "초 (", actualDurationMinutes.toFixed(2), "분)")
      
      // 목표 시간과 비교하여 경고
      if (actualDurationMinutes > selectedDuration * 1.3) {
        const warningMessage = `⚠️ 경고: 실제 오디오 길이가 목표 시간(${selectedDuration}분)보다 훨씬 깁니다.\n\n` +
          `실제 길이: ${actualDurationMinutes.toFixed(2)}분 (${actualAudioDuration.toFixed(1)}초)\n` +
          `목표 시간: ${selectedDuration}분\n\n` +
          `생성된 영상이 목표 시간보다 길어질 수 있습니다.`
        console.warn("[Shorts]", warningMessage)
        alert(warningMessage)
      } else if (actualDurationMinutes > selectedDuration * 1.1) {
        const infoMessage = `ℹ️ 실제 오디오 길이가 목표 시간보다 약간 깁니다.\n\n` +
          `실제 길이: ${actualDurationMinutes.toFixed(2)}분\n` +
          `목표 시간: ${selectedDuration}분`
        console.log("[Shorts]", infoMessage)
      }

      // MediaRecorder 설정
      const stream = canvas.captureStream(30) // 30fps
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const source = audioContext.createMediaElementSource(audio)
      const destination = audioContext.createMediaStreamDestination()
      source.connect(destination) // MediaRecorder에 오디오 포함 (필수)
      // source.connect(audioContext.destination) 제거 - 스피커로 출력하지 않음 (렌더링 중 소리 안 남)
      
      // 비디오 스트림과 오디오 스트림 합치기
      const videoTrack = stream.getVideoTracks()[0]
      const audioTrack = destination.stream.getAudioTracks()[0]
      const combinedStream = new MediaStream([videoTrack, audioTrack])

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: "video/webm;codecs=vp9,opus",
        videoBitsPerSecond: 5000000, // 5Mbps
      })

      const chunks: Blob[] = []
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: "video/webm" })
        const videoUrl = URL.createObjectURL(videoBlob)
        setVideoUrl(videoUrl)
        setActiveStep("render")
        URL.revokeObjectURL(audioUrl)
        
        console.log("[Shorts] MediaRecorder 렌더링 완료")
        
        // 롱폼 페이지의 사이드바에 쇼츠 생성기 체크 표시를 위해 localStorage 업데이트
        try {
          // 롱폼 페이지의 completedSteps 가져오기
          const longformStateStr = localStorage.getItem("longform_state")
          if (longformStateStr) {
            const longformState = JSON.parse(longformStateStr)
            const completedSteps = longformState.completedSteps || []
            
            // "shorts"가 없으면 추가
            if (!completedSteps.includes("shorts")) {
              completedSteps.push("shorts")
              longformState.completedSteps = completedSteps
              localStorage.setItem("longform_state", JSON.stringify(longformState))
              console.log("[Shorts] 롱폼 페이지 사이드바에 쇼츠 생성기 체크 표시 완료")
            }
          } else {
            // longform_state가 없으면 새로 생성
            const newState = {
              completedSteps: ["shorts"],
              activeStep: "topic"
            }
            localStorage.setItem("longform_state", JSON.stringify(newState))
            console.log("[Shorts] 롱폼 페이지 상태 생성 및 쇼츠 생성기 체크 표시 완료")
          }
          
          // 프로젝트 데이터에도 저장 (있는 경우)
          const projectDataStr = localStorage.getItem("longform_project_data")
          if (projectDataStr) {
            const projectData = JSON.parse(projectDataStr)
            if (!projectData.completedSteps) {
              projectData.completedSteps = []
            }
            if (!projectData.completedSteps.includes("shorts")) {
              projectData.completedSteps.push("shorts")
              localStorage.setItem("longform_project_data", JSON.stringify(projectData))
              
              // 같은 탭에서도 업데이트되도록 커스텀 이벤트 발생
              window.dispatchEvent(new CustomEvent("longformCompletedStepsUpdated", {
                detail: { completedSteps: projectData.completedSteps }
              }))
            }
          }
        } catch (error) {
          console.error("[Shorts] 사이드바 체크 상태 저장 실패:", error)
        }
        
        alert("영상 렌더링이 완료되었습니다!")
        setIsRendering(false)
      }

      // 이미지 미리 로드 (order 기준으로 정렬)
      const sortedImages = [...generatedImages].sort((a, b) => a.order - b.order)
      const images: HTMLImageElement[] = []
      for (const imgData of sortedImages) {
        const img = new Image()
        img.crossOrigin = "anonymous"
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = reject
          img.src = imgData.imageUrl
        })
        images.push(img)
      }

      // 렌더링 시작
      mediaRecorder.start()
      audio.play()

      // 미리보기와 동일한 렌더링 로직
      const renderFrame = () => {
        const elapsed = audio.currentTime

        // 캔버스 초기화
        ctx.fillStyle = "black"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // 제목 그리기 (미리보기와 동일)
        if (hookingTitle) {
          const line1 = hookingTitle.line1 || ""
          const line2 = hookingTitle.line2 || ""
          
          const lineHeight = 100
          const topMargin = 80
          const totalTitleHeight = 200 + topMargin + 20
          
          ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
          ctx.fillRect(0, 0, canvas.width, totalTitleHeight)
          
          // 텍스트가 잘리지 않도록 폰트 크기 동적 조정
          const maxWidth = canvas.width * 0.9 // 캔버스 너비의 90%를 최대 너비로 설정
          let fontSize = 96
          ctx.font = `bold ${fontSize}px Arial`
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"
          
          // line1 폰트 크기 조정
          let line1Metrics = ctx.measureText(line1)
          while (line1Metrics.width > maxWidth && fontSize > 40) {
            fontSize -= 2
            ctx.font = `bold ${fontSize}px Arial`
            line1Metrics = ctx.measureText(line1)
          }
          
          ctx.fillStyle = "yellow"
          ctx.fillText(line1, canvas.width / 2, 50 + topMargin)
          
          // line2 폰트 크기 조정 (line1과 동일한 크기 사용)
          const line2Metrics = ctx.measureText(line2)
          if (line2Metrics.width > maxWidth) {
            let fontSize2 = fontSize
            while (ctx.measureText(line2).width > maxWidth && fontSize2 > 40) {
              fontSize2 -= 2
              ctx.font = `bold ${fontSize2}px Arial`
            }
          }
          
          ctx.fillStyle = "white"
          ctx.fillText(line2, canvas.width / 2, 50 + topMargin + lineHeight)
        } else if (selectedTopic) {
          const lineHeight = 100
          const topMargin = 80
          const totalTitleHeight = 200 + topMargin + 20
          
          ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
          ctx.fillRect(0, 0, canvas.width, totalTitleHeight)
          ctx.fillStyle = "yellow"
          ctx.font = "bold 96px Arial"
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"
          
          const words = selectedTopic.split(" ")
          let line1 = ""
          let line2 = ""
          for (const word of words) {
            if (line1.length + word.length <= 6) {
              line1 += (line1 ? " " : "") + word
            } else if (line2.length + word.length <= 6) {
              line2 += (line2 ? " " : "") + word
            } else {
              break
            }
          }
          if (!line1) line1 = selectedTopic.substring(0, 6)
          if (!line2) line2 = selectedTopic.substring(6, 12) || ""
          
          ctx.fillText(line1, canvas.width / 2, 50 + topMargin)
          if (line2) {
            ctx.fillStyle = "white"
            ctx.fillText(line2, canvas.width / 2, 50 + topMargin + lineHeight)
          }
        }

        // 현재 시간에 맞는 이미지 찾기 (order 기준으로 순서대로 사용)
        const sortedImages = [...generatedImages].sort((a, b) => a.order - b.order)
        const currentLine = scriptLines.find(
          (line) => elapsed >= line.startTime / 1000 && elapsed <= line.endTime / 1000
        ) || scriptLines[scriptLines.length - 1]

        if (currentLine) {
          // 현재 라인의 인덱스 찾기
          const currentLineIndex = scriptLines.findIndex((line) => line.id === currentLine.id)
          
          // 순서대로 이미지 사용: 라인 인덱스를 이미지 인덱스로 매핑 (순환)
          let imageIndex = currentLineIndex % sortedImages.length
          
          if (imageIndex >= 0 && imageIndex < images.length && images[imageIndex]) {
            const img = images[imageIndex]
            const imageWidth = canvas.width
            const imageHeight = canvas.width
            const imageX = 0
            const titleHeight = hookingTitle ? 300 : 100
            const imageY = titleHeight + 30

            // 줌인 효과 제거 - 단순히 이미지 표시
            if (img.width === img.height) {
              // 정확히 1:1인 경우 그대로 표시
              ctx.drawImage(
                img,
                0, 0, img.width, img.height, // 소스: 전체 이미지
                imageX, imageY, imageWidth, imageHeight // 대상: 좌우 꽉 차게 표시
              )
            } else {
              // 1:1이 아닌 경우, 중앙에서 1:1 영역만 크롭하여 표시
              const sourceSize = Math.min(img.width, img.height)
              const sourceX = (img.width - sourceSize) / 2
              const sourceY = (img.height - sourceSize) / 2
              
              ctx.drawImage(
                img,
                sourceX, sourceY, sourceSize, sourceSize, // 소스: 중앙 1:1 영역
                imageX, imageY, imageWidth, imageHeight // 대상: 좌우 꽉 차게 표시
              )
            }
          } else if (images.length > 0) {
            const lastImg = images[images.length - 1]
            const imageWidth = canvas.width
            const imageHeight = canvas.width
            const imageX = 0
            const titleHeight = hookingTitle ? 300 : 100
            const imageY = titleHeight + 30

            // 줌인 효과 제거 - 단순히 이미지 표시
            if (lastImg.width === lastImg.height) {
              // 정확히 1:1인 경우 그대로 표시
              ctx.drawImage(
                lastImg,
                0, 0, lastImg.width, lastImg.height,
                imageX, imageY, imageWidth, imageHeight
              )
            } else {
              // 1:1이 아닌 경우, 중앙에서 1:1 영역만 크롭하여 표시
              const sourceSize = Math.min(lastImg.width, lastImg.height)
              const sourceX = (lastImg.width - sourceSize) / 2
              const sourceY = (lastImg.height - sourceSize) / 2
              
              ctx.drawImage(
                lastImg,
                sourceX, sourceY, sourceSize, sourceSize,
                imageX, imageY, imageWidth, imageHeight
              )
            }
          }
        }

        // 자막 그리기 (미리보기와 동일)
        if (currentLine) {
          const subtitleText = currentLine.text
          ctx.font = "bold 60px Arial"
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"
          
          const maxWidth = canvas.width - 80
          const lines: string[] = []
          const words = subtitleText.split(" ")
          let currentLineText = ""
          
          for (const word of words) {
            const testText = currentLineText ? `${currentLineText} ${word}` : word
            const textWidth = ctx.measureText(testText).width
            
            if (textWidth <= maxWidth) {
              currentLineText = testText
            } else {
              if (currentLineText) {
                lines.push(currentLineText)
              }
              if (ctx.measureText(word).width > maxWidth) {
                let charLine = ""
                for (const char of word) {
                  const testChar = charLine + char
                  if (ctx.measureText(testChar).width <= maxWidth) {
                    charLine = testChar
                  } else {
                    if (charLine) lines.push(charLine)
                    charLine = char
                  }
                }
                currentLineText = charLine
              } else {
                currentLineText = word
              }
            }
          }
          if (currentLineText) lines.push(currentLineText)

          // 오디오 버퍼 기반으로 정확한 자막 타이밍 계산
          const audioData = generatedAudios.find((a) => a.lineId === currentLine.id)
          const audioBuffer = audioData?.audioBuffer
          const audioDuration = audioData?.duration || ((currentLine.endTime - currentLine.startTime) / 1000)
          
          // splitIntoSubtitleLines 함수 (미리보기와 동일)
          const splitIntoSubtitleLines = (text: string, audioBuffer?: AudioBuffer, totalDuration: number = 0): Array<{ text: string; startTime: number; endTime: number }> => {
            const words = text.split(" ").filter(w => w.trim().length > 0)
            if (words.length === 0) return [{ text, startTime: 0, endTime: totalDuration }]
            
            const result: Array<{ text: string; startTime: number; endTime: number }> = []
            let wordStartTimes: number[] = []
            
            if (audioBuffer && totalDuration > 0) {
              const totalChars = words.reduce((sum, w) => sum + w.length, 0)
              let currentTime = 0
              
              for (const word of words) {
                const wordRatio = word.length / totalChars
                const wordDuration = wordRatio * totalDuration
                wordStartTimes.push(currentTime)
                currentTime += wordDuration
              }
            } else {
              const timePerWord = totalDuration / words.length
              for (let i = 0; i < words.length; i++) {
                wordStartTimes.push(i * timePerWord)
              }
            }
            
            let currentSubtitleLine: string[] = []
            let lineStartTime = 0
            
            for (let i = 0; i < words.length; i++) {
              const word = words[i]
              const testLine = currentSubtitleLine.length > 0 ? currentSubtitleLine.join(" ") + " " + word : word
              const textWidth = ctx.measureText(testLine).width
              
              if (textWidth > maxWidth && currentSubtitleLine.length >= 1) {
                if (currentSubtitleLine.length > 0) {
                  const lineEndTime = i < wordStartTimes.length ? wordStartTimes[i] : totalDuration
                  result.push({
                    text: currentSubtitleLine.join(" "),
                    startTime: lineStartTime,
                    endTime: lineEndTime,
                  })
                }
                currentSubtitleLine = [word]
                lineStartTime = wordStartTimes[i] || (i * (totalDuration / words.length))
              } else {
                currentSubtitleLine.push(word)
              }
            }
            
            if (currentSubtitleLine.length > 0) {
              result.push({
                text: currentSubtitleLine.join(" "),
                startTime: lineStartTime,
                endTime: totalDuration,
              })
            }
            
            return result.length > 0 ? result : [{ text, startTime: 0, endTime: totalDuration }]
          }
          
          const subtitleLines = splitIntoSubtitleLines(subtitleText, audioBuffer, audioDuration)
          const timeInLine = elapsed - (currentLine.startTime / 1000)
          const currentSubtitleLine = subtitleLines.find(
            (line) => timeInLine >= line.startTime && timeInLine <= line.endTime
          ) || subtitleLines[0] || { text: subtitleText, startTime: 0, endTime: audioDuration }
          
          const displayLine = currentSubtitleLine.text

          const subtitleHeight = 100
          ctx.fillStyle = "rgba(0, 0, 0, 0.75)"
          ctx.fillRect(0, canvas.height - subtitleHeight - 250, canvas.width, subtitleHeight)

          ctx.fillStyle = "white"
          let finalText = displayLine
          if (ctx.measureText(finalText).width > maxWidth) {
            while (ctx.measureText(finalText + "...").width > maxWidth && finalText.length > 0) {
              finalText = finalText.slice(0, -1)
            }
            finalText = finalText + "..."
          }
          ctx.fillText(finalText, canvas.width / 2, canvas.height - 250 - 50)
        }

        if (elapsed < actualAudioDuration) {
          requestAnimationFrame(renderFrame)
        } else {
          mediaRecorder.stop()
          audio.pause()
          audio.currentTime = 0
        }
      }

      renderFrame()
    } catch (error) {
      console.error("[Shorts] MediaRecorder 렌더링 실패:", error)
      alert(`영상 렌더링에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
      setIsRendering(false)
    }
  }

  // 다운로드
  const handleDownload = async () => {
    if (!videoUrl) return

    try {
      // MediaRecorder로 생성한 Blob URL이면 직접 다운로드
      if (videoUrl.startsWith("blob:")) {
        const response = await fetch(videoUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
        a.download = `shorts-${selectedTopic}-${selectedDuration}min.webm`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      } else {
        // 외부 URL인 경우
        const response = await fetch(videoUrl)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `shorts-${selectedTopic}-${selectedDuration}min.mp4`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error("다운로드 실패:", error)
      alert("다운로드에 실패했습니다.")
    }
  }

  const renderStepContent = () => {
    switch (activeStep) {
      case "category":
    return (
          <div className="space-y-8">
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                카테고리 선택
              </h2>
              <p className="text-gray-500 text-sm">원하는 콘텐츠 카테고리를 선택해주세요</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {categoryOrder.map((category) => {
                const info = categoryInfo[category]
    return (
                  <Card
                    key={category}
                    className={`group cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-2xl border-2 ${
                      selectedCategory === category 
                        ? "ring-4 ring-purple-500 ring-offset-2 shadow-xl border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50" 
                        : "border-gray-200 hover:border-purple-300 hover:shadow-lg"
                    }`}
                    onClick={() => setSelectedCategory(category)}
                  >
                    <CardContent className="p-8 text-center relative overflow-hidden">
                      {/* 배경 그라데이션 효과 */}
                      <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 bg-gradient-to-br ${info.gradient}`} />
                      
                      <div className={`text-5xl mb-4 transform transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}>
                        {info.icon}
                      </div>
                      <h3 className={`text-xl font-bold relative z-10 ${
                        selectedCategory === category 
                          ? "bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent" 
                          : "text-gray-800"
                      }`}>
                        {info.name}
                      </h3>
                      {selectedCategory === category && (
                        <div className="mt-3">
                          <div className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold rounded-full">
                            <Sparkles className="w-3 h-3" />
                            선택됨
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
            
            {/* 직접입력 선택 시 입력 칸 표시 */}
            {selectedCategory === "custom" && (
              <Card className="border-2 border-purple-500 shadow-xl bg-gradient-to-br from-purple-50 to-pink-50 animate-in fade-in-50 duration-300">
                <CardContent className="p-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    <Label htmlFor="customTopic" className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      주제 직접 입력
                    </Label>
                  </div>
                  <Textarea
                    id="customTopic"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    placeholder="예: 인공지능의 미래, 건강한 식습관, 투자 초보자를 위한 팁 등..."
                    rows={4}
                    className="w-full border-2 border-purple-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                  />
                  <p className="text-sm text-gray-600 mt-3 flex items-center gap-1">
                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                    입력한 주제를 바탕으로 대본이 생성됩니다.
                  </p>
                </CardContent>
              </Card>
            )}
            
            <Card className="border-2 border-gray-200 shadow-lg">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-purple-600" />
                    <Label className="text-lg font-semibold">영상 길이 선택</Label>
                  </div>
                  <div className="flex gap-3">
                    {[1, 2, 3].map((duration) => (
                      <Button
                        key={duration}
                        variant={selectedDuration === duration ? "default" : "outline"}
                        onClick={() => setSelectedDuration(duration as ShortsDuration)}
                        className={`flex-1 transition-all duration-300 ${
                          selectedDuration === duration
                            ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg scale-105"
                            : "hover:border-purple-300 hover:scale-105"
                        }`}
                      >
                        <Clock className="w-4 h-4 mr-2" />
                        {duration}분
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Button
              onClick={handleGenerateTopics}
              disabled={!selectedCategory || isGeneratingTopics || (selectedCategory === "custom" && !customTopic.trim())}
              className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              size="lg"
            >
              {isGeneratingTopics ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  주제 생성 중...
                </>
              ) : selectedCategory === "custom" ? (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  주제 생성하기 (15개)
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  주제 생성하기
                </>
              )}
            </Button>
          </div>
        )

      case "topic":
    return (
          <div className="space-y-8">
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                주제 선택
              </h2>
              <p className="text-gray-500 text-sm">마음에 드는 주제를 선택해주세요</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {topics.map((topic, index) => (
                <Card
                  key={index}
                  className={`group cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl border-2 ${
                    selectedTopic === topic 
                      ? "ring-4 ring-purple-500 ring-offset-2 shadow-xl border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50" 
                      : "border-gray-200 hover:border-purple-300 hover:shadow-lg"
                  }`}
                  onClick={() => setSelectedTopic(topic)}
                >
                  <CardContent className="p-6 relative overflow-hidden">
                    {/* 배경 그라데이션 효과 */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 bg-gradient-to-br from-purple-500 to-pink-500" />
                    
                    <div className="flex items-start gap-3 relative z-10">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                        selectedTopic === topic
                          ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white scale-110"
                          : "bg-gray-100 text-gray-600 group-hover:bg-purple-100 group-hover:text-purple-600"
                      }`}>
                        {index + 1}
                      </div>
                      <p className={`text-base font-medium flex-1 leading-relaxed ${
                        selectedTopic === topic ? "text-purple-900 font-semibold" : "text-gray-800"
                      }`}>
                        {topic}
                      </p>
                      {selectedTopic === topic && (
                        <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 animate-pulse" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex gap-4">
              <Button 
                variant="outline" 
                onClick={() => setActiveStep("category")}
                className="border-2 hover:border-purple-300 hover:bg-purple-50 transition-all duration-300"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                뒤로가기
              </Button>
              <Button
                onClick={handleGenerateScript}
                disabled={!selectedTopic || isGeneratingScript}
                className="flex-1 h-14 text-lg font-semibold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                size="lg"
              >
                {isGeneratingScript ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    대본 생성 중...
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5 mr-2" />
                    대본 생성하기
                  </>
                )}
              </Button>
            </div>
            </div>
        )

      case "script":
        return (
          <div className="space-y-8">
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                대본 확인
              </h2>
              <p className="text-gray-500 text-sm">생성된 대본을 확인하고 수정할 수 있습니다</p>
            </div>
            <Card className="border-2 border-gray-200 shadow-xl">
              <CardContent className="p-8">
                <Textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  className="min-h-[200px]"
                  placeholder="대본이 여기에 표시됩니다..."
                />
                {script && script.trim().length > 0 && (
                  <div className="mt-4">
                    <Button
                      onClick={async () => {
                        if (!script || typeof script !== 'string' || script.trim().length === 0) {
                          alert("대본이 필요합니다.")
                          return
                        }
                        
                        // 대본 요약 생성 (대본의 앞부분을 요약으로 사용)
                        const summary = script.substring(0, 200).replace(/\n/g, " ").trim()
                        const finalSummary = summary.length > 100 
                          ? summary.substring(0, 100) + "..." 
                          : summary
                        setScriptSummary(finalSummary)
                        console.log("[Shorts] 대본 요약 생성 완료:", finalSummary)
                        
                        // 대본 요약 생성 후 자동으로 후킹 제목 생성
                        try {
                          setIsGeneratingTitle(true)
                          const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("openai_api_key") || undefined : undefined
                          if (!openaiApiKey) {
                            alert("OpenAI API 키가 필요합니다. 메인 화면의 설정에서 API 키를 입력해주세요.")
                            setIsGeneratingTitle(false)
                            return
                          }
                          
                          console.log("[Shorts] 대본 요약 후 자동 제목 생성 시작")
                          const title = await generateShortsHookingTitle(finalSummary, script, openaiApiKey)
                          console.log("[Shorts] 자동 생성된 제목:", title)
                          setHookingTitle(title)
                        } catch (error) {
                          console.error("제목 생성 실패:", error)
                          alert("제목 생성에 실패했습니다.")
                        } finally {
                          setIsGeneratingTitle(false)
                        }
                      }}
                      variant="outline"
                      className="w-full"
                      size="sm"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      대본 요약하기
                    </Button>
                    {scriptSummary && (
                      <p className="text-xs text-gray-500 mt-2">
                        대본 요약: {scriptSummary}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 제목 생성 섹션 */}
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">제목 생성</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      AI가 후킹될만한 제목을 두 줄로 생성합니다. 대본 요약을 기반으로 제목이 생성됩니다.
                    </p>
                  </div>
                  <Button
                    variant="default"
                    onClick={async () => {
                      console.log("[Shorts] 후킹 제목 생성 버튼 클릭, script 상태:", script ? `길이: ${script.length}` : "없음")
                      if (!script || typeof script !== 'string' || script.trim().length === 0) {
                        alert("대본이 필요합니다. 먼저 대본을 생성해주세요.")
                        return
                      }
                      setIsGeneratingTitle(true)
                      try {
                        const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("openai_api_key") || undefined : undefined
                        if (!openaiApiKey) {
                          alert("OpenAI API 키가 필요합니다. 메인 화면의 설정에서 API 키를 입력해주세요.")
                          setIsGeneratingTitle(false)
                          return
                        }
                        
                        // 대본을 기반으로 제목 생성 (대본 요약 활용)
                        // 대본 요약이 있으면 사용, 없으면 생성
                        let topicToUse = scriptSummary
                        if (!topicToUse || topicToUse.trim().length === 0) {
                          const summary = script.substring(0, 200).replace(/\n/g, " ").trim()
                          topicToUse = summary.length > 100 
                            ? summary.substring(0, 100) + "..." 
                            : summary
                          setScriptSummary(topicToUse) // 요약 저장
                        }
                        
                        console.log("[Shorts] 대본 기반 제목 생성 중... (대본 요약 사용)")
                        console.log("[Shorts] 대본 요약:", topicToUse)
                        
                        // 대본 전체를 전달하여 제목 생성 (대본 요약을 주제로 사용)
                        const title = await generateShortsHookingTitle(topicToUse, script, openaiApiKey)
                        console.log("[Shorts] 생성된 제목:", title)
                        setHookingTitle(title)
                      } catch (error) {
                        console.error("제목 생성 실패:", error)
                        alert("제목 생성에 실패했습니다.")
                      } finally {
                        setIsGeneratingTitle(false)
                      }
                    }}
                    className="w-full !opacity-100 !pointer-events-auto cursor-pointer"
                    size="lg"
                  >
                      {isGeneratingTitle ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          제목 생성 중...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          후킹 제목 생성하기
                        </>
                      )}
                    </Button>
                    {hookingTitle && (
                      <div className="p-4 bg-muted rounded-lg space-y-3">
                        <p className="text-sm font-semibold mb-2">생성된 제목 (수정 가능):</p>
                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">첫 번째 줄 (꾸며주는 말)</Label>
                            <Input
                              value={hookingTitle.line1}
                              onChange={(e) => setHookingTitle({ ...hookingTitle, line1: e.target.value })}
                              className="text-lg font-bold text-yellow-600 bg-yellow-50 border-yellow-300"
                              placeholder="첫 번째 줄 입력"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">두 번째 줄 (핵심 내용)</Label>
                            <Input
                              value={hookingTitle.line2}
                              onChange={(e) => setHookingTitle({ ...hookingTitle, line2: e.target.value })}
                              className="text-lg font-bold text-white bg-black border-gray-600"
                              placeholder="두 번째 줄 입력"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    {/* 제목 미리보기 */}
                    {hookingTitle && generatedImages.length > 0 && (
                      <div className="mt-4 p-4 bg-muted rounded-lg">
                        <p className="text-sm font-semibold mb-3">제목 미리보기</p>
                        <div className="relative w-full aspect-[9/16] bg-black rounded-lg overflow-hidden">
                          <canvas
                            ref={titlePreviewCanvasRef}
                            className="w-full h-full"
                            style={{ imageRendering: 'auto' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

            {/* 이미지 스타일 선택 */}
            <Card className="border-2 border-gray-200 shadow-xl">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b-2 border-purple-100">
                <CardTitle className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-2">
                  <ImageIcon className="w-6 h-6 text-purple-600" />
                  이미지 스타일 선택
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "stickman-animation", label: "스틱맨 애니메이션", icon: "🎨" },
                    { id: "realistic", label: "실사화", icon: "📸" },
                    { id: "realistic2", label: "실사화2", icon: "🖼️" },
                    { id: "animation2", label: "애니메이션2", icon: "✨" },
                    { id: "animation3", label: "유럽풍 그래픽 노블", icon: "🎭" },
                  ].map((style) => (
                    <Button
                      key={style.id}
                      variant={imageStyle === style.id ? "default" : "outline"}
                      onClick={() => setImageStyle(style.id)}
                      className={`flex-1 h-14 transition-all duration-300 ${
                        imageStyle === style.id
                          ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg scale-105"
                          : "hover:border-purple-300 hover:scale-105 hover:shadow-md"
                      }`}
                    >
                      <span className="mr-2 text-lg">{style.icon}</span>
                      {style.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 사용자 이미지 업로드 (이미지 생성 전) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">이미지 추가 (선택사항)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-3">
                  이미지 생성 전에 사용자 이미지를 미리 추가할 수 있습니다. 추가한 이미지는 생성된 이미지와 함께 사용됩니다.
                </p>
                <label
                  htmlFor="pre-image-upload"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">클릭하거나 드래그하여 이미지 업로드</p>
                  <p className="text-xs text-gray-400 mt-1">여러 이미지 선택 가능</p>
                </label>
                <input
                  id="pre-image-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    const files = event.target.files
                    if (!files || files.length === 0) return

                    Array.from(files).forEach((file) => {
                      if (!file.type.startsWith("image/")) {
                        alert(`${file.name}은(는) 이미지 파일이 아닙니다.`)
                        return
                      }

                      const reader = new FileReader()
                      reader.onload = (e) => {
                        const imageUrl = e.target?.result as string
                        setGeneratedImages((prev) => {
                          const newImages = [
                            ...prev,
                            {
                              lineId: Date.now() + Math.random(), // 고유 ID
                              imageUrl,
                              prompt: "사용자 업로드 이미지",
                              order: prev.length,
                              isUserUploaded: true,
                            },
                          ]
                          // order 기준으로 정렬
                          return newImages.sort((a, b) => a.order - b.order)
                        })
                      }
                      reader.readAsDataURL(file)
                    })

                    // input 초기화
                    event.target.value = ""
                  }}
                  className="hidden"
                />
                
                {/* 업로드된 이미지 미리보기 */}
                {generatedImages.filter(img => img.isUserUploaded).length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">업로드된 이미지 ({generatedImages.filter(img => img.isUserUploaded).length}개)</p>
                    <div className="grid grid-cols-3 gap-2">
                      {generatedImages
                        .filter(img => img.isUserUploaded)
                        .map((img, index) => (
                          <div key={`pre-${img.lineId}`} className="relative">
                            <div className="aspect-square w-full bg-muted rounded-lg overflow-hidden">
                              <img
                                src={img.imageUrl}
                                alt={`Uploaded ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="absolute top-1 right-1 h-5 w-5 p-0"
                              onClick={() => {
                                setGeneratedImages((prev) => {
                                  const newImages = prev.filter((i) => i.lineId !== img.lineId)
                                  return newImages.map((img, i) => ({ ...img, order: i }))
                                })
                              }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button 
                variant="outline" 
                onClick={() => setActiveStep("topic")}
                className="border-2 hover:border-purple-300 hover:bg-purple-50 transition-all duration-300"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                뒤로가기
              </Button>
              <Button
                onClick={handleGenerateImages}
                disabled={isGeneratingImages}
                className="flex-1 h-14 text-lg font-semibold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                size="lg"
              >
                {isGeneratingImages ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    이미지 생성 중... ({generatedImages.length}/{scriptLines.length})
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-5 h-5 mr-2" />
                    이미지 생성하기
                  </>
                )}
              </Button>
            </div>
      </div>
    )

      case "image":
        // 이미지 순서 변경 함수
        const handleImageReorder = (fromIndex: number, toIndex: number) => {
          setGeneratedImages((prev) => {
            const newImages = [...prev]
            const [movedImage] = newImages.splice(fromIndex, 1)
            newImages.splice(toIndex, 0, movedImage)
            // order 업데이트
            return newImages.map((img, index) => ({ ...img, order: index }))
          })
        }

        // 이미지 삭제 함수
        const handleImageDelete = (index: number) => {
          const sortedImages = [...generatedImages].sort((a, b) => a.order - b.order)
          const imageToDelete = sortedImages[index]
          
          setGeneratedImages((prev) => {
            const newImages = prev.filter((img) => img.lineId !== imageToDelete.lineId && img.imageUrl !== imageToDelete.imageUrl)
            // order 재정렬
            return newImages.map((img, i) => ({ ...img, order: i }))
          })
        }

        // 사용자 이미지 업로드 함수
        const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
          const files = event.target.files
          if (!files || files.length === 0) return

          Array.from(files).forEach((file) => {
            if (!file.type.startsWith("image/")) {
              alert(`${file.name}은(는) 이미지 파일이 아닙니다.`)
              return
            }

            const reader = new FileReader()
            reader.onload = (e) => {
              const imageUrl = e.target?.result as string
              setGeneratedImages((prev) => {
                const newImages = [
                  ...prev,
                  {
                    lineId: Date.now() + Math.random(), // 고유 ID
                    imageUrl,
                    prompt: "사용자 업로드 이미지",
                    order: prev.length,
                    isUserUploaded: true,
                  },
                ]
                // order 기준으로 정렬
                return newImages.sort((a, b) => a.order - b.order)
              })
            }
            reader.readAsDataURL(file)
          })

          // input 초기화 (같은 파일 다시 선택 가능하도록)
          event.target.value = ""
        }

        // 드래그 시작
        const handleDragStart = (e: React.DragEvent, index: number) => {
          console.log("[드래그] 시작:", index)
          setDraggedImageIndex(index)
          e.dataTransfer.effectAllowed = "move"
          e.dataTransfer.setData("text/plain", index.toString())
          e.dataTransfer.setData("application/json", JSON.stringify({ index }))
          // 드래그 중 시각적 피드백
          if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = "0.5"
          }
        }

        // 드래그 오버 (드롭 허용)
        const handleDragOver = (e: React.DragEvent, index: number) => {
          e.preventDefault()
          e.stopPropagation()
          e.dataTransfer.dropEffect = "move"
          
          // 드롭 대상 하이라이트
          if (draggedImageIndex !== null && draggedImageIndex !== index) {
            if (e.currentTarget instanceof HTMLElement) {
              e.currentTarget.style.border = "2px solid #3b82f6"
            }
          }
        }

        // 드래그 리브 (하이라이트 제거)
        const handleDragLeave = (e: React.DragEvent) => {
          if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.border = ""
          }
        }

        // 드롭 처리
        const handleDrop = (e: React.DragEvent, dropIndex: number) => {
          e.preventDefault()
          e.stopPropagation()
          console.log("[드롭] 드롭 인덱스:", dropIndex, "드래그 인덱스:", draggedImageIndex)
          
          // 하이라이트 제거
          if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.border = ""
            e.currentTarget.style.opacity = "1"
          }
          
          if (draggedImageIndex === null || draggedImageIndex === dropIndex) {
            setDraggedImageIndex(null)
            return
          }

          // 정렬된 이미지 목록 가져오기
          const sortedImages = [...generatedImages].sort((a, b) => a.order - b.order)
          const newImages = [...sortedImages]
          const draggedImage = newImages[draggedImageIndex]
          
          console.log("[드롭] 드래그된 이미지:", draggedImage)
          
          // 드래그된 이미지 제거
          newImages.splice(draggedImageIndex, 1)
          
          // 드롭 위치에 삽입 (인덱스 조정)
          let insertIndex = dropIndex
          if (draggedImageIndex < dropIndex) {
            // 뒤로 이동하는 경우: 제거 후 인덱스가 하나 줄어듦
            insertIndex = dropIndex - 1
          }
          // 앞으로 이동하는 경우: 그대로 사용
          newImages.splice(insertIndex, 0, draggedImage)

          console.log("[드롭] 새 순서:", newImages.map((img, i) => ({ order: i, lineId: img.lineId })))

          // order 업데이트
          const reorderedImages = newImages.map((img, i) => ({ ...img, order: i }))
          setGeneratedImages(reorderedImages)
          setDraggedImageIndex(null)
        }

        // 드래그 종료
        const handleDragEnd = (e: React.DragEvent) => {
          console.log("[드래그] 종료")
          // 스타일 복원
          if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = "1"
            e.currentTarget.style.border = ""
          }
          setDraggedImageIndex(null)
        }

        // 정렬된 이미지 목록 (order 기준)
        const sortedImages = [...generatedImages].sort((a, b) => a.order - b.order)

        return (
          <div className="space-y-8">
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                이미지 확인 및 순서 조정
              </h2>
              <p className="text-gray-500 text-sm">이미지를 확인하고 순서를 조정할 수 있습니다</p>
            </div>
            
            {/* 사용자 이미지 업로드 */}
            <Card className="border-2 border-gray-200 shadow-xl">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b-2 border-purple-100">
                <CardTitle className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-2">
                  <Upload className="w-6 h-6 text-purple-600" />
                  이미지 업로드
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <label
                  htmlFor="image-upload"
                  className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-purple-300 rounded-xl cursor-pointer bg-gradient-to-br from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 transition-all duration-300 hover:border-purple-500 hover:shadow-lg group"
                >
                  <Upload className="w-10 h-10 text-purple-500 mb-3 group-hover:scale-110 transition-transform duration-300" />
                  <p className="text-base font-semibold text-gray-700 group-hover:text-purple-600 transition-colors">클릭하거나 드래그하여 이미지 업로드</p>
                  <p className="text-xs text-gray-500 mt-2">여러 이미지 선택 가능</p>
                </label>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </CardContent>
            </Card>

            {/* 이미지 목록 (드래그 앤 드롭 가능) */}
            <Card className="border-2 border-gray-200 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  <p className="text-sm font-medium text-gray-700">
                    💡 이미지를 드래그하여 순서를 변경할 수 있습니다. 순서대로 영상에 사용됩니다.
                  </p>
                </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {sortedImages.map((img, index) => (
                  <Card
                    key={`${img.lineId}-${img.order}`}
                    draggable={true}
                    onDragStart={(e) => {
                      e.stopPropagation()
                      handleDragStart(e, index)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleDragOver(e, index)
                    }}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleDrop(e, index)
                    }}
                    onDragEnd={handleDragEnd}
                    className={`group cursor-move transition-all duration-300 select-none border-2 ${
                      draggedImageIndex === index 
                        ? "opacity-50 scale-95 border-purple-400" 
                        : "hover:shadow-2xl hover:scale-105 border-gray-200 hover:border-purple-300"
                    }`}
                    style={{
                      userSelect: "none",
                      WebkitUserSelect: "none",
                    }}
                  >
                    <CardContent 
                      className="p-3 relative overflow-hidden"
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                    >
                      {/* 배경 그라데이션 효과 */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 bg-gradient-to-br from-purple-500 to-pink-500" />
                      
                      {/* 드래그 핸들 */}
                      <div className="absolute top-2 left-2 z-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-1.5 shadow-lg opacity-80 group-hover:opacity-100 transition-opacity">
                        <GripVertical className="w-4 h-4 text-white" />
                      </div>
                      
                      {/* 삭제 버튼 */}
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2 z-10 h-7 w-7 p-0 rounded-full shadow-lg hover:scale-110 transition-transform"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleImageDelete(index)
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>

                      {/* 순서 번호 */}
                      <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold shadow-lg">
                        {index + 1}
                      </div>

                      {/* 이미지 */}
                      <div className="aspect-square w-full bg-muted rounded-lg overflow-hidden flex items-center justify-center mt-6">
                        <img
                          src={img.imageUrl}
                          alt={`Image ${index + 1}`}
                          className="w-full h-full object-contain"
                          draggable={false}
                          onDragStart={(e) => e.preventDefault()}
                        />
                      </div>

                      {/* 사용자 업로드 표시 */}
                      {img.isUserUploaded && (
                        <div className="mt-2 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-semibold rounded-full shadow-md">
                            <Upload className="w-3 h-3" />
                            사용자 업로드
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {sortedImages.length === 0 && (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 mb-4">
                    <ImageIcon className="w-12 h-12 text-purple-400" />
                  </div>
                  <p className="text-gray-500 font-medium">이미지가 없습니다</p>
                  <p className="text-sm text-gray-400 mt-1">이미지를 생성하거나 업로드해주세요</p>
                </div>
              )}
              </CardContent>
            </Card>
            {/* 목소리 선택 */}
            <Card className="border-2 border-gray-200 shadow-xl">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b-2 border-purple-100">
                <CardTitle className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-2">
                  <Volume2 className="w-6 h-6 text-purple-600" />
                  목소리 선택
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto p-3 border-2 border-gray-100 rounded-xl bg-gradient-to-br from-gray-50 to-white">
                  {[
                    { id: "ttsmaker-여성1", name: "TTSMaker 여성1", note: "ID: 503", provider: "ttsmaker" },
                    { id: "ttsmaker-여성2", name: "TTSMaker 여성2", note: "ID: 509", provider: "ttsmaker" },
                    { id: "ttsmaker-여성6", name: "TTSMaker 여성3", note: "ID: 5802", provider: "ttsmaker" },
                    { id: "ttsmaker-남성1", name: "TTSMaker 남성1", note: "ID: 5501", provider: "ttsmaker" },
                    { id: "ttsmaker-남성4", name: "TTSMaker 남성2", note: "ID: 5888", provider: "ttsmaker" },
                    { id: "ttsmaker-남성5", name: "TTSMaker 남성3", note: "ID: 5888 (음높이 -10%)", provider: "ttsmaker" },
                  ].map((voice) => (
                    <div
                      key={voice.id}
                      className={`group p-4 border-2 rounded-xl transition-all duration-300 cursor-pointer ${
                        selectedVoiceId === voice.id
                          ? "border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 shadow-lg scale-105 ring-2 ring-purple-300"
                          : "border-gray-200 hover:border-purple-300 hover:shadow-md hover:scale-105 bg-white"
                      }`}
                      onClick={() => setSelectedVoiceId(voice.id)}
                    >
                      <div className="flex items-center space-x-3 mb-3">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                            selectedVoiceId === voice.id 
                              ? "border-purple-600 bg-gradient-to-r from-purple-600 to-pink-600 shadow-md" 
                              : "border-gray-300 group-hover:border-purple-400"
                          }`}
                        >
                          {selectedVoiceId === voice.id && (
                            <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-semibold ${
                            selectedVoiceId === voice.id ? "text-purple-900" : "text-gray-800"
                          }`}>
                            {voice.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{voice.note}</p>
                        </div>
                        {selectedVoiceId === voice.id && (
                          <Sparkles className="w-4 h-4 text-purple-600 animate-pulse" />
                        )}
                      </div>
                      <Button
                        variant={selectedVoiceId === voice.id ? "default" : "outline"}
                        size="sm"
                        className={`w-full text-xs transition-all duration-300 ${
                          selectedVoiceId === voice.id
                            ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md"
                            : "hover:border-purple-300 hover:text-purple-600"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePreviewVoice(voice.id)
                        }}
                        disabled={previewingVoiceId === voice.id}
                      >
                        {previewingVoiceId === voice.id ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            재생 중...
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3 mr-1" />
                            미리듣기
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
                {previewAudioUrl && (
                  <audio
                    src={previewAudioUrl}
                    autoPlay
                    onEnded={() => {
                      setPreviewAudioUrl(null)
                      setPreviewingVoiceId(null)
                    }}
                    className="w-full mt-4"
                  />
                )}
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button 
                variant="outline" 
                onClick={() => setActiveStep("script")}
                className="border-2 hover:border-purple-300 hover:bg-purple-50 transition-all duration-300"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                뒤로가기
              </Button>
              <Button
                onClick={handleGenerateTts}
                disabled={isGeneratingTts}
                className="flex-1 h-14 text-lg font-semibold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                size="lg"
              >
                {isGeneratingTts ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    TTS 생성 중...
                  </>
                ) : (
                  <>
                    <Volume2 className="w-5 h-5 mr-2" />
                    TTS 생성하기
                  </>
                )}
              </Button>
            </div>
          </div>
        )

      case "tts":
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold mb-6">음성 확인</h2>
            {ttsGenerationProgress.total > 0 && (
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>TTS 생성 중...</span>
                      <span>{ttsGenerationProgress.current}/{ttsGenerationProgress.total}</span>
        </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                        style={{
                          width: `${(ttsGenerationProgress.current / ttsGenerationProgress.total) * 100}%`,
                        }}
                      />
      </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {ttsAudioUrl && (
              <Card>
                <CardContent className="p-6">
                  <audio controls src={ttsAudioUrl} className="w-full" />
                  <p className="text-sm text-muted-foreground mt-2">
                    {generatedAudios.length}개의 오디오가 합쳐졌습니다.
                  </p>
                </CardContent>
              </Card>
            )}
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setActiveStep("image")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                뒤로가기
              </Button>
              <Button
                onClick={() => setActiveStep("preview")}
                disabled={!ttsAudioUrl}
                className="flex-1"
                size="lg"
              >
                <Play className="w-4 h-4 mr-2" />
                미리보기
              </Button>
                </div>
          </div>
        )

      case "preview":
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold mb-6">미리보기</h2>
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* 캔버스 미리보기 */}
                  <div className="flex justify-center">
                    <div className="relative" style={{ width: "540px", height: "960px" }}>
                      <canvas
                        ref={canvasRef}
                        className="w-full h-full border-2 border-gray-300 rounded-lg"
                        style={{ aspectRatio: "9/16" }}
                      />
                  </div>
                </div>

                  {/* 재생 컨트롤 */}
                  <div className="space-y-4">
                    <div className="text-xs text-muted-foreground text-center">
                      상태: TTS {ttsAudioUrl ? "✓" : "✗"} | 이미지 {generatedImages.length}개 | 대본 {scriptLines.length}개
                  </div>
                    
                    {/* 재생바 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-16 text-right">
                          {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, "0")}
                        </span>
                        <Slider
                          value={[currentTime]}
                          max={scriptLines.length > 0 ? scriptLines[scriptLines.length - 1]?.endTime / 1000 || 0 : 0}
                          step={0.1}
                          className="flex-1"
                          onValueChange={(value) => {
                            const newTime = value[0]
                            setCurrentTime(newTime)
                            if (previewAudio) {
                              previewAudio.currentTime = newTime
                            }
                          }}
                        />
                        <span className="text-sm text-muted-foreground w-16">
                          {Math.floor((scriptLines[scriptLines.length - 1]?.endTime / 1000 || 0) / 60)}:{(Math.floor((scriptLines[scriptLines.length - 1]?.endTime / 1000 || 0) % 60)).toString().padStart(2, "0")}
                        </span>
                </div>
              </div>

                    {/* 재생 컨트롤 버튼 및 볼륨 */}
                    <div className="flex items-center justify-center gap-4">
                      <Button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          console.log("[Preview] 재생 버튼 클릭 이벤트", {
                            ttsAudioUrl: !!ttsAudioUrl,
                            images: generatedImages.length,
                            scriptLines: scriptLines.length
                          })
                          handlePreviewPlayPause()
                        }}
                        disabled={!ttsAudioUrl || generatedImages.length === 0 || scriptLines.length === 0}
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
                      
                      {/* 볼륨 조절 */}
                      <div className="flex items-center gap-2 w-40">
                        <Volume2 className="w-4 h-4 text-muted-foreground" />
                        <Slider
                          value={[volume * 100]}
                          max={100}
                          step={1}
                          className="flex-1"
                          onValueChange={(value) => {
                            const newVolume = value[0] / 100
                            setVolume(newVolume)
                            if (previewAudio) {
                              previewAudio.volume = newVolume
                            }
                          }}
                        />
                        <span className="text-xs text-muted-foreground w-8">
                          {Math.round(volume * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* 제목 생성 */}
            {!hookingTitle && (
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">제목 생성</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        AI가 후킹될만한 제목을 두 줄로 생성합니다. 대본 요약을 기반으로 제목이 생성됩니다.
                </p>
              </div>
                    <div className="flex gap-4 items-start">
                      {/* 제목 생성 버튼 */}
                      <div className="flex-1">
                      <Button
                      onClick={async () => {
                        console.log("[Shorts] 후킹 제목 생성 버튼 클릭, script 상태:", script ? `길이: ${script.length}` : "없음")
                        if (!script || typeof script !== 'string' || script.trim().length === 0) {
                          alert("대본이 필요합니다. 먼저 대본을 생성해주세요.")
                          return
                        }
                        setIsGeneratingTitle(true)
                        try {
                          const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("openai_api_key") || undefined : undefined
                          if (!openaiApiKey) {
                            alert("OpenAI API 키가 필요합니다. 메인 화면의 설정에서 API 키를 입력해주세요.")
                            setIsGeneratingTitle(false)
                            return
                          }
                          
                          // 대본을 기반으로 제목 생성 (대본 요약 활용)
                          // 대본 요약이 있으면 사용, 없으면 생성
                          let topicToUse = scriptSummary
                          if (!topicToUse || topicToUse.trim().length === 0) {
                            const summary = script.substring(0, 200).replace(/\n/g, " ").trim()
                            topicToUse = summary.length > 100 
                              ? summary.substring(0, 100) + "..." 
                              : summary
                            setScriptSummary(topicToUse) // 요약 저장
                          }
                          
                          console.log("[Shorts] 대본 기반 제목 생성 중... (대본 요약 사용)")
                          console.log("[Shorts] 대본 요약:", topicToUse)
                          
                          // 대본 전체를 전달하여 제목 생성 (대본 요약을 주제로 사용)
                          const title = await generateShortsHookingTitle(topicToUse, script, openaiApiKey)
                          console.log("[Shorts] 생성된 제목:", title)
                          setHookingTitle(title)
                        } catch (error) {
                          console.error("제목 생성 실패:", error)
                          alert("제목 생성에 실패했습니다.")
                        } finally {
                          setIsGeneratingTitle(false)
                        }
                      }}
                      className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 !opacity-100 !pointer-events-auto cursor-pointer"
                      size="lg"
                    >
                      {isGeneratingTitle ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          제목 생성 중...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 mr-2" />
                          후킹 제목 생성하기
                        </>
                      )}
                    </Button>
                      </div>
                      
                      {/* 제목 배치 샘플 시뮬레이션 */}
                      <div className="flex-1">
                        <div className="relative aspect-[9/16] bg-black rounded-lg overflow-hidden border-2 border-gray-300">
                          {/* 샘플 배경 (첫 번째 이미지 또는 그라데이션) */}
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 opacity-80">
                            {generatedImages.length > 0 && generatedImages[0]?.imageUrl ? (
                              <img 
                                src={generatedImages[0].imageUrl} 
                                alt="샘플 배경" 
                                className="w-full h-full object-cover opacity-50"
                              />
                            ) : null}
                          </div>
                          
                          {/* 샘플 제목 배치 */}
                          <div className="absolute inset-0 flex flex-col justify-start items-center pt-8 px-4">
                            {/* 첫 번째 줄 (노란색) */}
                            <div className="text-center mb-2">
                              <div className="inline-block px-4 py-2 bg-yellow-500 rounded-lg shadow-lg">
                                <p className="text-white font-bold text-lg leading-tight">
                                  샘플 제목 첫 줄
                                </p>
                              </div>
                            </div>
                            
                            {/* 두 번째 줄 (흰색) */}
                            <div className="text-center">
                              <div className="inline-block px-4 py-2 bg-black/70 rounded-lg shadow-lg backdrop-blur-sm">
                                <p className="text-white font-bold text-xl leading-tight">
                                  샘플 제목 두 번째 줄
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {/* 설명 텍스트 */}
                          <div className="absolute bottom-2 left-0 right-0 text-center">
                            <p className="text-xs text-white/70 bg-black/50 px-2 py-1 rounded">
                              제목 배치 미리보기
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          생성된 제목이 이렇게 배치됩니다
                        </p>
                      </div>
                    </div>
                    {hookingTitle ? (
                      <div className="p-4 bg-muted rounded-lg space-y-3">
                        <p className="text-sm font-semibold mb-2">생성된 제목 (수정 가능):</p>
                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">첫 번째 줄 (꾸며주는 말)</Label>
                            <Input
                              value={(hookingTitle as { line1: string; line2: string }).line1}
                              onChange={(e) => setHookingTitle({ ...(hookingTitle as { line1: string; line2: string }), line1: e.target.value })}
                              className="text-lg font-bold text-yellow-600 bg-yellow-50 border-yellow-300"
                              placeholder="첫 번째 줄 입력"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">두 번째 줄 (핵심 내용)</Label>
                            <Input
                              value={(hookingTitle as { line1: string; line2: string }).line2}
                              onChange={(e) => setHookingTitle({ ...(hookingTitle as { line1: string; line2: string }), line2: e.target.value })}
                              className="text-lg font-bold text-white bg-black border-gray-600"
                              placeholder="두 번째 줄 입력"
                            />
                          </div>
                        </div>
                      </div>
                    ) : null}
                    </div>
                </CardContent>
              </Card>
            )}
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setActiveStep("tts")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                뒤로가기
              </Button>
              <Button
                onClick={handleRenderVideo}
                disabled={isRendering || !ttsAudioUrl}
                className="flex-1"
                size="lg"
              >
                {isRendering ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    영상 렌더링 중...
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4 mr-2" />
                    영상 렌더링하기
                  </>
                )}
              </Button>
                    </div>
                  </div>
        )

      case "render":
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold mb-6">완성된 영상</h2>
            {videoUrl && (
              <Card>
                <CardContent className="p-6">
                  <div className="aspect-[9/16] max-w-md mx-auto bg-black rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      controls
                      className="w-full h-full object-contain"
                    />
                    </div>
                </CardContent>
              </Card>
            )}
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setActiveStep("tts")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                뒤로가기
              </Button>
              <Button onClick={handleDownload} className="flex-1" size="lg">
                <Download className="w-4 h-4 mr-2" />
                다운로드
              </Button>
                    </div>
                    </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/WingsAIStudio">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  뒤로가기
                </Button>
              </Link>
              <Link href="/WingsAIStudio">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Home className="w-4 h-4" />
                  홈으로
                </Button>
              </Link>
                    </div>
            <h1 className="text-2xl font-bold">쇼츠 제작 (9:16)</h1>
            <div className="w-32" />
                  </div>
                </div>
              </div>

      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <Card className="border-2 border-gray-200 shadow-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white pb-6">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-2xl font-bold">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <Video className="w-7 h-7" />
                  </div>
                  쇼츠 영상 제작
                </CardTitle>
                <Link href="/WingsAIStudio">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-white hover:bg-white/20 hover:text-white"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    홈으로
                  </Button>
                </Link>
              </div>
              <p className="text-white/90 text-sm mt-2 ml-14">
                AI로 쉽고 빠르게 쇼츠 영상을 만들어보세요
              </p>
            </CardHeader>
            <CardContent className="p-8 bg-white">{renderStepContent()}</CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  Volume2,
  RefreshCw,
  Bot,
  ArrowRight,
  ChevronDown,
  Copy,
  Check,
  CalendarClock,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import Link from "next/link"
import { generateShoppingScript, generateVideoWithSora2, generateImagesWith3Scenes, splitScriptIntoScenes, convertImageToVideoWithWan, convertImagesToVideosWithScript, generateImage, generateImageWithNanobanana, generateVideoWithSeedance, generateShortsThumbnail, generateThumbnailHookingText, generateYouTubeMetadata, getNaverTrendingKeywords, analyzeScriptParts, generateImagePromptsFromScript, refineImagePromptWithCustomInput, mergeVideos, generateVideoPromptFromScript, generateVideoPromptFor3Scenes, generateVideoPromptForImage } from "./actions"
import { getApiKey } from "@/lib/api-keys"
import { getShoppingProjects, createShoppingProject, updateShoppingProject, deleteShoppingProject, getShoppingProject, uploadTTSAudio, type ShoppingProject, type ShoppingProjectData } from "./project-actions"
import { getAudioLibrary, getAllAudioLibrary, type AudioLibraryItem } from "./audio-library-actions"
import { Plus, Trash2, Edit2, Search, FolderOpen, Factory, Cog, ChevronLeft, ChevronRight, Settings } from "lucide-react"

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

// 예약 발행 (ShotForm 쇼핑 전용)
const SHOTFORM_SCHEDULES_STORAGE_KEY = "wings_shotform_shopping_schedules"
const SHOTFORM_SCHEDULES_DB_NAME = "WingsShotFormShoppingSchedules"
const SHOTFORM_SCHEDULES_DB_STORE = "videos"

export interface ShoppingScheduleItem {
  id: string
  productName: string
  productDescription?: string
  scheduleAt: string
  createdAt: string
  status: "scheduled"
}

function openShotFormSchedulesDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SHOTFORM_SCHEDULES_DB_NAME, 1)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(SHOTFORM_SCHEDULES_DB_STORE)) {
        db.createObjectStore(SHOTFORM_SCHEDULES_DB_STORE, { keyPath: "id" })
      }
    }
  })
}

function saveShotFormScheduleVideoBlob(id: string, blob: Blob): Promise<void> {
  return openShotFormSchedulesDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SHOTFORM_SCHEDULES_DB_STORE, "readwrite")
      const store = tx.objectStore(SHOTFORM_SCHEDULES_DB_STORE)
      store.put({ id, blob })
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error) }
    })
  })
}

function getShotFormScheduleVideoBlob(id: string): Promise<Blob | null> {
  return openShotFormSchedulesDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SHOTFORM_SCHEDULES_DB_STORE, "readonly")
      const store = tx.objectStore(SHOTFORM_SCHEDULES_DB_STORE)
      const req = store.get(id)
      req.onsuccess = () => {
        db.close()
        resolve(req.result?.blob ?? null)
      }
      req.onerror = () => { db.close(); reject(req.error) }
    })
  })
}

function deleteShotFormScheduleVideoBlob(id: string): Promise<void> {
  return openShotFormSchedulesDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SHOTFORM_SCHEDULES_DB_STORE, "readwrite")
      const store = tx.objectStore(SHOTFORM_SCHEDULES_DB_STORE)
      store.delete(id)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error) }
    })
  })
}

// 공장 자동화 (공장 모드): 날짜별 상품·이미지·목소리만 정해두면 해당 날에 영상 자동 생성
const FACTORY_SCHEDULES_STORAGE_KEY = "wings_shotform_factory_schedules"

export interface FactoryScheduleItem {
  id: string
  scheduledDate: string // YYYY-MM-DD
  scheduledTime?: string // HH:mm (발행 시·분)
  productName: string
  productDescription?: string
  productImageBase64: string | null // 썸네일용 작은 base64 가능
  voiceId: string // selectedVoiceId 형식 (ttsmaker-여성1, supertone-xxx 등)
  status: "pending" | "generating" | "ready" | "failed"
  phase?: string // 실행 단계: product | script | video | render | thumbnail | preview
  createdAt: string
  errorMessage?: string
  videoBlobId?: string // ready일 때 ShotForm schedule ID와 동일하게 사용 가능
  projectId?: string // 공장 자동화 자동 생성 시 생성·저장되는 프로젝트 ID
  /** 예약 완료 시 유튜브 업로드에 사용 (제목/설명/태그 생성기 값) */
  youtubeTitle?: string
  youtubeDescription?: string
  youtubeTags?: string[]
  /** 공장 자동화에서 자동 업로드 완료된 경우 true (목록에서 다운로드 버튼 대신 유튜브 업로드 완료 표시) */
  youtubeUploaded?: boolean
}

const FACTORY_PHASE_LABELS: Record<string, string> = {
  product: "제품 입력",
  script: "대본·TTS 생성",
  video: "이미지 생성",
  render: "영상 생성",
  thumbnail: "썸네일 생성",
  preview: "미리보기·렌더링",
}

// 공장 자동화 단계 순서 및 단계별 이름 (완료/진행 중 표시용)
const FACTORY_PHASES_ORDER: Array<{ key: string; label: string }> = [
  { key: "script", label: "대본생성" },
  { key: "video", label: "이미지생성" },
  { key: "tts", label: "TTS생성" },
  { key: "render", label: "영상생성" },
  { key: "preview", label: "미리보기" },
]

function getFactoryPhaseDisplayText(phase: string | undefined): string {
  if (!phase) return "진행 중"
  const idx = FACTORY_PHASES_ORDER.findIndex((p) => p.key === phase)
  if (idx < 0) return FACTORY_PHASE_LABELS[phase] || phase
  const parts: string[] = []
  for (let i = 0; i < FACTORY_PHASES_ORDER.length; i++) {
    if (i < idx) parts.push(`${FACTORY_PHASES_ORDER[i].label} 완료`)
    else if (i === idx) parts.push(`${FACTORY_PHASES_ORDER[i].label} 중`)
    else break
  }
  return parts.join(" → ")
}

// 자막: 단어 중간에서 끊지 않고, 공백 단위로 묶어서 한 줄씩 표시 (예: "이거 하나로 요리가" / "진짜 쉬워져요")
const SUBTITLE_MAX_CHARS_PER_LINE = 11

// "될 거예요" → "될거예요"처럼 띄어쓰기된 어미/보조용언을 한 단위로 묶음 (줄 나눔 시 "될" / "거예요"로 끊기지 않도록)
function mergeKoreanEndingSpaces(text: string): string {
  return text
    .replace(/\s+(거예요|거야|것 같아|수 있어|수 있죠|겁니다|습니다|해요|돼요|되죠|될까요)\b/g, (m) => m.trim())
    .replace(/\s+(거예요|거야)\s*$/g, (m) => m.trim())
}

function getSubtitlePhrases(text: string): string[] {
  if (!text || !text.trim()) return []
  const merged = mergeKoreanEndingSpaces(text.trim())
  const tokens = merged.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return [merged]
  const lines: string[] = []
  let currentLine = ""
  for (const token of tokens) {
    const next = currentLine ? `${currentLine} ${token}` : token
    if (next.length <= SUBTITLE_MAX_CHARS_PER_LINE) {
      currentLine = next
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = token
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines.length >= 1 ? lines : [merged]
}

// 공장 자동화 6단계 스테퍼용: phase → 스텝 인덱스 (0=제품입력, 1=대본·TTS, 2=이미지, 3=영상, 4=썸네일, 5=완료)
function getFactoryPhaseStepIndex(phase: string | undefined): number {
  if (!phase) return 0
  const map: Record<string, number> = {
    product: 0,
    script: 1,
    tts: 1,
    video: 2,
    render: 3,
    thumbnail: 4,
    preview: 5,
  }
  return map[phase] ?? 0
}

export default function ShoppingPage() {
  const [productName, setProductName] = useState("")
  const [productDescription, setProductDescription] = useState("")
  const [productImage, setProductImage] = useState<string | null>(null)
  const [productImageFile, setProductImageFile] = useState<File | null>(null)
  const [productImageAspectRatio, setProductImageAspectRatio] = useState<number | null>(null) // 제품 이미지 비율 (width/height)
  const [script, setScript] = useState("")
  const [videoUrl, setVideoUrl] = useState<string>("")
  const [imageUrls, setImageUrls] = useState<string[]>([]) // 3개 장면 이미지 URL 배열
  const [convertedVideoUrls, setConvertedVideoUrls] = useState<Map<number, string>>(new Map()) // 각 장면별로 변환된 영상 URL 저장
  const [imagePrompts, setImagePrompts] = useState<Array<{ type: string; prompt: string; description: string; scriptText: string }>>([]) // 이미지 프롬프트 배열
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false) // 프롬프트 생성 중 여부
  const [promptsGenerated, setPromptsGenerated] = useState(false) // 프롬프트 생성 완료 여부
  const [videoPrompts, setVideoPrompts] = useState<Map<number, string>>(new Map()) // 각 장면별 영상 프롬프트 저장 (인덱스 -> 프롬프트)
  const [isGeneratingVideoPrompts, setIsGeneratingVideoPrompts] = useState<Map<number, boolean>>(new Map()) // 각 장면별 영상 프롬프트 생성 중 여부
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [isConvertingToVideo, setIsConvertingToVideo] = useState<Map<number, boolean>>(new Map()) // 각 장면별 변환 중 여부
  const [isRegeneratingImage, setIsRegeneratingImage] = useState<Map<number, boolean>>(new Map()) // 각 이미지별 재생성 중 여부
  const [customImagePrompts, setCustomImagePrompts] = useState<Map<number, string>>(new Map()) // 각 이미지별 추가 프롬프트 (한국어)
  const [isMergingVideos, setIsMergingVideos] = useState(false) // 영상 합치기 중 여부
  const [activeStep, setActiveStep] = useState<"product" | "script" | "video" | "render" | "thumbnail" | "preview">("product")
  const [error, setError] = useState<string>("")
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number }>({ current: 0, total: 3 })
  
  // TTS 및 영상 렌더링 관련 상태
  const [scenes, setScenes] = useState<string[]>([]) // 3개 장면 텍스트
  const [scriptLines, setScriptLines] = useState<ScriptLine[]>([]) // 자막용 라인
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string>("")
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false)
  const [ttsProgress, setTtsProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 })
  const [isRendering, setIsRendering] = useState(false)
  const [isServerDownloading, setIsServerDownloading] = useState(false) // 서버 다운로드(Cloud Run 렌더) 중
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false) // 미리보기 생성 중 상태
  const [previewGenerated, setPreviewGenerated] = useState(false) // 미리보기 생성 완료 여부
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("ttsmaker-여성1") // 기본: TTSMaker 여성1
  const [customElevenLabsVoices, setCustomElevenLabsVoices] = useState<Array<{ id: string; name: string }>>([]) // 사용자 추가 일레븐랩스 목소리
  const [supertoneVoices, setSupertoneVoices] = useState<Array<{ voice_id: string; name: string; language: string[]; styles: string[]; thumbnail_image_url?: string }>>([]) // 수퍼톤 음성 목록
  const [isLoadingSupertoneVoices, setIsLoadingSupertoneVoices] = useState(false) // 수퍼톤 음성 목록 로딩 중
  const [selectedSupertoneVoiceId, setSelectedSupertoneVoiceId] = useState<string>("") // 선택된 수퍼톤 음성 ID
  const [selectedSupertoneStyle, setSelectedSupertoneStyle] = useState<string>("neutral") // 선택된 수퍼톤 스타일
  const [customElevenLabsVoiceId, setCustomElevenLabsVoiceId] = useState<string>("") // 사용자가 입력한 ElevenLabs 음성 ID
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null)
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null)
  const [previewVideoElements, setPreviewVideoElements] = useState<HTMLVideoElement[]>([]) // 미리보기용 비디오 엘리먼트
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null) // 미리보기용 오디오
  const [previewBgmAudio, setPreviewBgmAudio] = useState<HTMLAudioElement | null>(null) // 미리보기용 BGM 오디오
  const [previewSfxAudio, setPreviewSfxAudio] = useState<HTMLAudioElement | null>(null) // 미리보기용 효과음 오디오
  const [previewAnimationFrame, setPreviewAnimationFrame] = useState<number | null>(null) // 미리보기 애니메이션 프레임 (사용 안 함, 롱폼 방식)
  const [previewThumbnailImage, setPreviewThumbnailImage] = useState<HTMLImageElement | null>(null) // 미리보기용 썸네일 이미지
  const [currentSubtitle, setCurrentSubtitle] = useState<string>("") // 현재 자막 (롱폼 방식)
  const previewVideoRef = useRef<HTMLVideoElement | null>(null) // 미리보기용 비디오 ref (롱폼 방식)
  const [currentVideoIndex, setCurrentVideoIndex] = useState<number>(-1) // 현재 재생 중인 영상 인덱스
  const [previousVideoIndex, setPreviousVideoIndex] = useState<number>(-1) // 이전 재생 중인 영상 인덱스
  const [videoTransitionOpacity, setVideoTransitionOpacity] = useState<number>(1) // 영상 전환 효과용 opacity
  
  // Canvas 및 미리보기 관련
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const previewContainerRef = useRef<HTMLDivElement | null>(null)
  
  // 썸네일 생성기 관련
  const [thumbnailUrl, setThumbnailUrl] = useState<string>("")
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false)
  const [thumbnailHookingText, setThumbnailHookingText] = useState<{ line1: string; line2: string }>({ line1: "", line2: "" })
  const thumbnailCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [draggingBgmHandle, setDraggingBgmHandle] = useState<"start" | "end" | null>(null) // BGM 핸들 드래그 중

  // 예약 발행 (ShotForm 쇼핑)
  const [scheduledItems, setScheduledItems] = useState<ShoppingScheduleItem[]>([])
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [scheduleDate, setScheduleDate] = useState("")
  const [scheduleTime, setScheduleTime] = useState("09:00")
  const [isScheduling, setIsScheduling] = useState(false)
  const [draggingSfxHandle, setDraggingSfxHandle] = useState<"start" | "end" | null>(null) // 효과음 핸들 드래그 중
  const timelineRef = useRef<HTMLDivElement | null>(null) // 타임라인 재생바 ref
  const bgmTimelineRef = useRef<HTMLDivElement | null>(null) // BGM 타임라인 ref
  const sfxTimelineRef = useRef<HTMLDivElement | null>(null) // 효과음 타임라인 ref
  const [thumbnailMode, setThumbnailMode] = useState<"ai" | "manual">("ai") // AI 생성 또는 직접 생성
  const [thumbnailImages, setThumbnailImages] = useState<Array<{ url: string; text: { line1: string; line2: string }; isCustom: boolean }>>([]) // 여러 썸네일 저장
  const [selectedThumbnailIndex, setSelectedThumbnailIndex] = useState<number>(-1) // 선택된 썸네일 인덱스
  const [customThumbnailImage, setCustomThumbnailImage] = useState<string>("") // 직접 업로드한 이미지
  const [customThumbnailText, setCustomThumbnailText] = useState<{ line1: string; line2: string }>({ line1: "", line2: "" }) // 직접 생성한 썸네일의 텍스트
  const [customThumbnailTextStyle, setCustomThumbnailTextStyle] = useState<{
    line1Color: string
    line2Color: string
    fontSize: number // 글씨 크기 (48 ~ 200)
    position: number // 0.0 ~ 1.0 (0 = 상단, 0.5 = 중앙, 1.0 = 하단)
    strokeWidth: number // 테두리 두께
    strokeColor: string // 테두리 색상
    imageScale: number // 이미지 확대/축소 (0.5 ~ 2.0)
    textRotation: number // 텍스트 회전 각도 (도 단위, -180 ~ 180)
  }>({
    line1Color: "#FFFFFF", // 흰색
    line2Color: "#00FFCC", // 민트색
    fontSize: 100, // 글씨 크기 (기본 100px)
    position: 0.45, // 중앙 약간 위
    strokeWidth: 4,
    strokeColor: "#000000", // 검정색 테두리
    imageScale: 1.0, // 기본 100%
    textRotation: 0 // 기본 회전 없음
  })

  // 새로운 기능 관련 상태
  const [videoDuration, setVideoDuration] = useState<12 | 15 | 20 | 30>(12) // 영상 길이 옵션
  const [isEditingScript, setIsEditingScript] = useState(false) // 대본 편집 모드
  const [editedScript, setEditedScript] = useState("") // 편집된 대본
  const [scriptParts, setScriptParts] = useState<Array<{ part: string; text: string; startIndex: number; endIndex: number }>>([]) // 대본 파트 분석 결과
  const [isAnalyzingScript, setIsAnalyzingScript] = useState(false) // 대본 분석 중 여부
  
  // 자막 스타일 설정
  const [subtitleStyle, setSubtitleStyle] = useState({
    fontSize: 48,
    fontFamily: "Pretendard",
    color: "#FFFFFF",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    position: "center" as "top" | "center" | "bottom",
    positionOffset: 0, // 위치 세부 조정 (픽셀 단위, -200 ~ +200)
    textAlign: "center" as "left" | "center" | "right",
    fontWeight: "bold" as "normal" | "bold",
    textShadow: true,
  })
  
  // BGM 관련 상태
  const [bgmUrl, setBgmUrl] = useState<string>("")
  const [bgmFile, setBgmFile] = useState<File | null>(null)
  const [bgmVolume, setBgmVolume] = useState(0.3) // BGM 볼륨 (0-1)
  const [bgmStartTime, setBgmStartTime] = useState(0) // BGM 시작 시간 (초)
  const [bgmEndTime, setBgmEndTime] = useState(0) // BGM 종료 시간 (초)
  const [ttsVolume, setTtsVolume] = useState(1.0) // TTS 볼륨 (0-1)
  
  // 효과음 관련 상태
  const [sfxUrl, setSfxUrl] = useState<string>("")
  const [sfxFile, setSfxFile] = useState<File | null>(null)
  const [sfxVolume, setSfxVolume] = useState(0.5) // 효과음 볼륨 (0-1)
  const [sfxStartTime, setSfxStartTime] = useState(0) // 효과음 시작 시간 (초)
  const [sfxEndTime, setSfxEndTime] = useState(0) // 효과음 종료 시간 (초)
  
  // 오디오 라이브러리 관련 상태
  const [bgmLibrary, setBgmLibrary] = useState<AudioLibraryItem[]>([])
  const [sfxLibrary, setSfxLibrary] = useState<AudioLibraryItem[]>([])
  const [isLoadingAudioLibrary, setIsLoadingAudioLibrary] = useState(false)
  const [showBgmLibraryDialog, setShowBgmLibraryDialog] = useState(false)
  const [showSfxLibraryDialog, setShowSfxLibraryDialog] = useState(false)
  
  // 영상 효과 및 전환
  const [transitionEffect, setTransitionEffect] = useState<"none" | "fade" | "slide" | "zoom">("fade")
  const [transitionDuration, setTransitionDuration] = useState(0.5) // 전환 시간 (초)
  
  // 제목/설명/태그 자동 생성
  const [youtubeTitle, setYoutubeTitle] = useState("")
  const [youtubeDescription, setYoutubeDescription] = useState("")
  const [youtubeTags, setYoutubeTags] = useState<string[]>([])
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false)
  const [copiedTitle, setCopiedTitle] = useState(false)
  const [copiedDescription, setCopiedDescription] = useState(false)
  const [copiedTags, setCopiedTags] = useState(false)

  // 프로젝트 관리 상태
  const [projects, setProjects] = useState<ShoppingProject[]>([])
  const [currentProject, setCurrentProject] = useState<ShoppingProject | null>(null)
  const [showProjectList, setShowProjectList] = useState(true) // 프로젝트 목록 화면 표시 여부
  const [showFactoryView, setShowFactoryView] = useState(false) // 공장 자동화(공장 모드) 화면
  const [factorySchedules, setFactorySchedules] = useState<FactoryScheduleItem[]>([])
  const [showAddFactoryScheduleDialog, setShowAddFactoryScheduleDialog] = useState(false)
  const [factoryCalendarMonth, setFactoryCalendarMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const [newFactoryDate, setNewFactoryDate] = useState("")
  const [newFactoryTime, setNewFactoryTime] = useState("09:00")
  const [newFactoryName, setNewFactoryName] = useState("")
  const [newFactoryDesc, setNewFactoryDesc] = useState("")
  const [newFactoryImage, setNewFactoryImage] = useState<string | null>(null)
  const [newFactoryVoiceId, setNewFactoryVoiceId] = useState("ttsmaker-여성1")
  const [factoryAutoRunItem, setFactoryAutoRunItem] = useState<FactoryScheduleItem | null>(null)
  /** 공장 자동화 백그라운드 파이프라인 대기 큐 (순차 처리용) */
  const [factoryPipelineQueue, setFactoryPipelineQueue] = useState<FactoryScheduleItem[]>([])
  /** 현재 파이프라인 실행 중인 예약 ID (목록에서 '작업 중' 표시용) */
  const [factoryPipelineRunningItemId, setFactoryPipelineRunningItemId] = useState<string | null>(null)
  const factoryPipelineRunningRef = useRef(false)
  const [showFactorySettingsDialog, setShowFactorySettingsDialog] = useState(false)
  const [uploadingFactoryId, setUploadingFactoryId] = useState<string | null>(null)
  const [youtubeChannelName, setYoutubeChannelName] = useState<string | null>(null) // 연동된 유튜브 채널명 (공장 자동화 → 자동 업로드용)
  const [youtubeClientId, setYoutubeClientId] = useState("")
  const [youtubeClientSecret, setYoutubeClientSecret] = useState("")
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isSavingProject, setIsSavingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDescription, setNewProjectDescription] = useState("")
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false)
  const [projectSearchQuery, setProjectSearchQuery] = useState("") // 프로젝트 검색어
  const [userId, setUserId] = useState<string>("") // 사용자 ID
  const [isEditingProjectName, setIsEditingProjectName] = useState(false)
  const [editingProjectName, setEditingProjectName] = useState("")

  // 윙스봇 챗봇 상태
  const [isChatbotOpen, setIsChatbotOpen] = useState(false) // 챗봇 열림/닫힘
  const [chatbotMessages, setChatbotMessages] = useState<Array<{ type: "user" | "assistant"; content: string }>>([]) // 챗봇 메시지
  const [chatbotInput, setChatbotInput] = useState<string>("") // 챗봇 입력
  const [isChatbotGenerating, setIsChatbotGenerating] = useState(false) // 챗봇 응답 생성 중

  // 네이버 인기 키워드 상태
  const [trendingKeywords, setTrendingKeywords] = useState<string[]>([])
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(false)
  const [showKeywordsDialog, setShowKeywordsDialog] = useState(false)

  // 네이버 인기 키워드 가져오기
  const handleLoadTrendingKeywords = async () => {
    setIsLoadingKeywords(true)
    setShowKeywordsDialog(true)
    
    // 최소 5초 동안 애니메이션 유지
    const minLoadingTime = 5000
    const startTime = Date.now()
    
    try {
      const keywords = await getNaverTrendingKeywords("쇼핑")
      console.log("[Frontend] 받은 키워드:", keywords)
      
      // 최소 로딩 시간이 지나지 않았다면 대기
      const elapsedTime = Date.now() - startTime
      if (elapsedTime < minLoadingTime) {
        await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsedTime))
      }
      
      setTrendingKeywords(keywords || [])
      
      // 키워드가 없으면 기본 키워드 표시
      if (!keywords || keywords.length === 0) {
        const defaultKeywords = [
          "난로",
          "패딩",
          "코트",
          "목도리",
          "장갑",
          "부츠",
          "히트텍",
          "내복",
          "담요",
          "전기장판"
        ]
        setTrendingKeywords(defaultKeywords)
      }
    } catch (error) {
      console.error("인기 키워드 로드 실패:", error)
      
      // 최소 로딩 시간이 지나지 않았다면 대기
      const elapsedTime = Date.now() - startTime
      if (elapsedTime < minLoadingTime) {
        await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsedTime))
      }
      
      // 에러 발생 시에도 기본 키워드 표시
      const defaultKeywords = [
        "난로",
        "패딩",
        "코트",
        "목도리",
        "장갑",
        "부츠",
        "히트텍",
        "내복",
        "담요",
        "전기장판"
      ]
      setTrendingKeywords(defaultKeywords)
    } finally {
      setIsLoadingKeywords(false)
    }
  }

  // 키워드 선택 시 제품명에 자동 입력
  const handleSelectKeyword = (keyword: string) => {
    setProductName(keyword)
    setShowKeywordsDialog(false)
  }

  // 사용자 ID 가져오기
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch("/api/kakao/user")
        const data = await response.json()
        
        if (data.loggedIn && data.user) {
          const userIdentifier = data.user.email || `kakao_${data.user.id}`
          setUserId(userIdentifier)
        } else {
          const storedUserId = localStorage.getItem("user_id") || localStorage.getItem("user_email") || "anonymous"
          setUserId(storedUserId)
        }
      } catch (error) {
        console.error("[Shopping Projects] 사용자 정보 조회 실패:", error)
        const storedUserId = localStorage.getItem("user_id") || localStorage.getItem("user_email") || "anonymous"
        setUserId(storedUserId)
      }
    }
    
    fetchUserInfo()
  }, [])

  // 예약 발행 목록 로드 (ShotForm 쇼핑)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SHOTFORM_SCHEDULES_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as ShoppingScheduleItem[]
        setScheduledItems(Array.isArray(parsed) ? parsed : [])
      }
    } catch {
      setScheduledItems([])
    }
  }, [])

  const persistScheduledItems = (items: ShoppingScheduleItem[]) => {
    setScheduledItems(items)
    localStorage.setItem(SHOTFORM_SCHEDULES_STORAGE_KEY, JSON.stringify(items))
  }

  // 공장 자동화 목록 로드
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FACTORY_SCHEDULES_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as FactoryScheduleItem[]
        setFactorySchedules(Array.isArray(parsed) ? parsed : [])
      }
    } catch {
      setFactorySchedules([])
    }
  }, [])

  const persistFactorySchedules = (items: FactoryScheduleItem[]) => {
    setFactorySchedules(items)
    localStorage.setItem(FACTORY_SCHEDULES_STORAGE_KEY, JSON.stringify(items))
  }

  // 공장 자동 실행 중일 때 현재 단계(activeStep)를 예약 항목에 반영
  useEffect(() => {
    if (!factoryAutoRunItem) return
    const phase = activeStep
    setFactorySchedules((prev) => {
      const next = prev.map((s) =>
        s.id === factoryAutoRunItem.id ? { ...s, status: "generating" as const, phase } : s
      )
      localStorage.setItem(FACTORY_SCHEDULES_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [factoryAutoRunItem?.id, activeStep])

  // 예약 추가 다이얼로그 열릴 때 수퍼톤 목록이 없으면 자동 로드
  useEffect(() => {
    if (showAddFactoryScheduleDialog && supertoneVoices.length === 0 && !isLoadingSupertoneVoices) {
      fetchSupertoneVoices()
    }
  }, [showAddFactoryScheduleDialog])

  // 공장 자동화: 유튜브 채널 연동 상태 로드 (localStorage) + OAuth 콜백 처리
  useEffect(() => {
    const key = "shopping_factory_youtube_channel"
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem(key) : null
      if (saved) setYoutubeChannelName(saved)
      const savedId = typeof window !== "undefined" ? localStorage.getItem("shopping_factory_youtube_client_id") : null
      const savedSecret = typeof window !== "undefined" ? localStorage.getItem("shopping_factory_youtube_client_secret") : null
      if (savedId) setYoutubeClientId(savedId)
      if (savedSecret) setYoutubeClientSecret(savedSecret)
    } catch (_) {}
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const channelFromUrl = params.get("youtube_channel")
    const errorFromUrl = params.get("youtube_error")
    if (channelFromUrl) {
      try {
        const decoded = decodeURIComponent(channelFromUrl)
        setYoutubeChannelName(decoded)
        localStorage.setItem(key, decoded)
        window.history.replaceState({}, "", window.location.pathname + (window.location.hash || ""))
      } catch (_) {}
    }
    if (errorFromUrl) {
      const messages: Record<string, string> = {
        access_denied: "YouTube 연동이 취소되었습니다.",
        no_code: "인증 코드를 받지 못했습니다.",
        config: "YouTube API 설정을 확인해주세요.",
        no_tokens: "토큰을 받지 못했습니다. 다시 시도해주세요.",
        callback_failed: "연동 처리 중 오류가 발생했습니다.",
      }
      alert(messages[errorFromUrl] || `연동 오류: ${errorFromUrl}`)
      window.history.replaceState({}, "", window.location.pathname + (window.location.hash || ""))
    }
  }, [])

  // 프로젝트 목록 불러오기
  useEffect(() => {
    if (userId && showProjectList) {
      loadProjects()
    }
  }, [userId, showProjectList])

  // 썸네일 탭으로 돌아왔을 때 썸네일 다시 그리기
  useEffect(() => {
    if (activeStep === "thumbnail" && thumbnailUrl && thumbnailCanvasRef.current) {
      // 선택된 썸네일이 AI 생성 썸네일인지 확인
      const selectedThumbnail = selectedThumbnailIndex >= 0 ? thumbnailImages[selectedThumbnailIndex] : null
      if (selectedThumbnail && !selectedThumbnail.isCustom) {
        // AI 생성 썸네일은 이미 텍스트가 포함되어 있으므로 그대로 표시 (비율 유지)
        const canvas = thumbnailCanvasRef.current
        const ctx = canvas.getContext("2d")
        if (ctx) {
          canvas.width = 1080
          canvas.height = 1920
          const img = new Image()
          img.crossOrigin = "anonymous"
          img.src = thumbnailUrl
          img.onload = () => {
            // 비율 유지하며 그리기
            const imgAspect = img.width / img.height
            const canvasAspect = canvas.width / canvas.height
            
            let drawWidth: number
            let drawHeight: number
            let offsetX: number
            let offsetY: number
            
            if (imgAspect > canvasAspect) {
              // 이미지가 더 넓음 - 높이에 맞추고 좌우 크롭
              drawHeight = canvas.height
              drawWidth = drawHeight * imgAspect
              offsetX = (canvas.width - drawWidth) / 2
              offsetY = 0
            } else {
              // 이미지가 더 높음 - 너비에 맞추고 상하 크롭
              drawWidth = canvas.width
              drawHeight = drawWidth / imgAspect
              offsetX = 0
              offsetY = (canvas.height - drawHeight) / 2
            }
            
            // 검은 배경으로 채우기
            ctx.fillStyle = "black"
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            
            // 이미지 그리기 (비율 유지)
            ctx.drawImage(img, 0, 0, img.width, img.height, offsetX, offsetY, drawWidth, drawHeight)
          }
        }
      } else if (selectedThumbnail && selectedThumbnail.isCustom && thumbnailHookingText.line1) {
        // 직접 생성 썸네일은 텍스트를 렌더링
        renderThumbnailWithText(thumbnailUrl, thumbnailHookingText)
      }
    }
  }, [activeStep, thumbnailUrl, thumbnailHookingText, selectedThumbnailIndex, thumbnailImages])

  // 직접 생성 모드: 이미지와 텍스트가 모두 있을 때 실시간 미리보기 업데이트
  useEffect(() => {
    if (thumbnailMode === "manual" && customThumbnailImage && customThumbnailText.line1 && customThumbnailText.line2) {
      renderThumbnailWithText(customThumbnailImage, customThumbnailText)
    }
  }, [thumbnailMode, customThumbnailImage, customThumbnailText, customThumbnailTextStyle])

  // 전역 마우스 이벤트로 핸들 드래그 처리
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!previewAudio) return
      
      // BGM 핸들 드래그
      if (draggingBgmHandle && bgmUrl && bgmTimelineRef.current) {
        const rect = bgmTimelineRef.current.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const percentage = Math.max(0, Math.min(1, mouseX / rect.width))
        const newTime = percentage * previewAudio.duration
        
        if (draggingBgmHandle === "start") {
          setBgmStartTime(Math.max(0, Math.min(newTime, bgmEndTime)))
        } else {
          setBgmEndTime(Math.max(newTime, bgmStartTime))
        }
        return
      }
      
      // 효과음 핸들 드래그
      if (draggingSfxHandle && sfxUrl && sfxTimelineRef.current) {
        const rect = sfxTimelineRef.current.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const percentage = Math.max(0, Math.min(1, mouseX / rect.width))
        const newTime = percentage * previewAudio.duration
        
        if (draggingSfxHandle === "start") {
          setSfxStartTime(Math.max(0, Math.min(newTime, sfxEndTime)))
        } else {
          setSfxEndTime(Math.max(newTime, sfxStartTime))
        }
        return
      }
    }
    
    const handleMouseUp = () => {
      setDraggingBgmHandle(null)
      setDraggingSfxHandle(null)
    }
    
    if (draggingBgmHandle || draggingSfxHandle) {
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
      return () => {
        window.removeEventListener("mousemove", handleMouseMove)
        window.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [draggingBgmHandle, draggingSfxHandle, previewAudio, bgmUrl, sfxUrl, bgmEndTime, bgmStartTime, sfxEndTime, sfxStartTime])

  // BGM URL 변경 시 이전 BGM 정리
  useEffect(() => {
    return () => {
      // 컴포넌트 언마운트 또는 bgmUrl 변경 시 이전 BGM 정리
      if (previewBgmAudio) {
        console.log("[Shopping] BGM URL 변경 또는 컴포넌트 언마운트 - 이전 BGM 정리")
        previewBgmAudio.pause()
        previewBgmAudio.currentTime = 0
        previewBgmAudio.src = "" // 오디오 소스 제거
        previewBgmAudio.load() // 오디오 리소스 해제
        setPreviewBgmAudio(null)
      }
    }
  }, [bgmUrl, previewBgmAudio])

  // 오디오 라이브러리 로드
  useEffect(() => {
    const loadAudioLibrary = async () => {
      if (activeStep === "preview") {
        console.log("[Shopping] 오디오 라이브러리 로드 시작 (클라이언트)")
        setIsLoadingAudioLibrary(true)
        try {
          console.log("[Shopping] getAllAudioLibrary 호출 전")
          const result = await getAllAudioLibrary()
          console.log("[Shopping] getAllAudioLibrary 호출 후 - 결과:", result)
          console.log("[Shopping] 오디오 라이브러리 로드 완료 - BGM:", result.bgm.length, "개, SFX:", result.sfx.length, "개")
          console.log("[Shopping] BGM 목록:", result.bgm.map(a => a.name))
          console.log("[Shopping] SFX 목록:", result.sfx.map(a => a.name))
          setBgmLibrary(result.bgm)
          setSfxLibrary(result.sfx)
        } catch (error) {
          console.error("[Shopping] 오디오 라이브러리 로드 실패 (클라이언트):", error)
          // 에러가 발생해도 빈 배열로 설정
          setBgmLibrary([])
          setSfxLibrary([])
        } finally {
          setIsLoadingAudioLibrary(false)
        }
      } else {
        // preview 단계가 아니면 라이브러리 초기화
        setBgmLibrary([])
        setSfxLibrary([])
      }
    }
    loadAudioLibrary()
  }, [activeStep])

  // preview 단계 진입 시 유튜브 메타데이터 자동 생성
  useEffect(() => {
    const generateMetadataOnPreview = async () => {
      // preview 단계이고, 대본이 있고, 메타데이터가 없을 때만 자동 생성
      if (activeStep === "preview" && script.trim() && !youtubeTitle && !youtubeDescription && youtubeTags.length === 0) {
        const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined
        
        if (openaiApiKey) {
          console.log("[Shopping] preview 단계 진입, 유튜브 메타데이터 자동 생성 시작")
          setIsGeneratingMetadata(true)
          try {
            const metadata = await generateYouTubeMetadata(
              productName,
              productDescription || productName,
              script,
              openaiApiKey
            )
            setYoutubeTitle(metadata.title)
            setYoutubeDescription(metadata.description)
            setYoutubeTags(metadata.tags)
            console.log("[Shopping] 유튜브 메타데이터 자동 생성 완료")
          } catch (error) {
            console.error("메타데이터 자동 생성 실패:", error)
            // 자동 생성 실패해도 계속 진행 (사용자가 수동으로 생성할 수 있음)
          } finally {
            setIsGeneratingMetadata(false)
          }
        }
      }
    }

    generateMetadataOnPreview()
  }, [activeStep, script, productName, productDescription, youtubeTitle, youtubeDescription, youtubeTags])

  // 프로젝트 목록 로드
  const loadProjects = async () => {
    if (!userId) return
    
    setIsLoadingProjects(true)
    try {
      const projectsList = await getShoppingProjects(userId)
      // 최신 작업 순으로 정렬 (updated_at 기준, 없으면 created_at 기준)
      const sortedProjects = [...projectsList].sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at).getTime()
        const dateB = new Date(b.updated_at || b.created_at).getTime()
        return dateB - dateA // 최신순 (내림차순)
      })
      setProjects(sortedProjects)
    } catch (error) {
      console.error("프로젝트 목록 로드 실패:", error)
      alert("프로젝트 목록을 불러오는데 실패했습니다.")
    } finally {
      setIsLoadingProjects(false)
    }
  }

  // 프로젝트 저장
  const saveProject = async (projectName?: string, isNewProject: boolean = false) => {
    if (!userId) {
      alert("로그인이 필요합니다.")
      return
    }

    // 프로젝트 이름 결정 (제품명과 별도로 관리)
    let name: string
    if (isNewProject) {
      // 새 프로젝트 생성 시: 반드시 입력받은 이름 사용
      name = newProjectName || projectName || "새 프로젝트"
    } else if (currentProject) {
      // 기존 프로젝트 업데이트 시: 현재 프로젝트 이름 유지 또는 입력받은 이름 사용
      name = projectName || currentProject.name
    } else {
      // 프로젝트가 없는 경우: 입력받은 이름 또는 기본값
      name = projectName || newProjectName || "새 프로젝트"
    }
    
    if (!name.trim()) {
      alert("프로젝트 이름을 입력해주세요.")
      return
    }

    setIsSavingProject(true)
    try {
      // TTS: 화면에 나오는 오디오 URL 그대로 저장 (TTS 생성 시 이미 Supabase 업로드한 영구 URL이면 그대로, blob이면 업로드 후 URL로 저장)
      let finalTtsAudioUrl = ttsAudioUrl && ttsAudioUrl.trim() ? ttsAudioUrl : undefined
      if (finalTtsAudioUrl && finalTtsAudioUrl.startsWith("blob:")) {
        const projectIdForUpload = currentProject?.id
        if (projectIdForUpload) {
        try {
          const audioResponse = await fetch(finalTtsAudioUrl)
          const audioBlob = await audioResponse.blob()
            finalTtsAudioUrl = await uploadTTSAudio(audioBlob, projectIdForUpload, userId)
        } catch (uploadError) {
            console.error("[Shopping] 오디오 업로드 실패:", uploadError)
            finalTtsAudioUrl = currentProject?.data?.ttsAudioUrl && !currentProject.data.ttsAudioUrl.startsWith("blob:") ? currentProject.data.ttsAudioUrl : undefined
          }
        } else {
          finalTtsAudioUrl = undefined
        }
      }
      if (currentProject && !isNewProject && finalTtsAudioUrl && finalTtsAudioUrl.startsWith("blob:")) {
        finalTtsAudioUrl = currentProject.data?.ttsAudioUrl && !currentProject.data.ttsAudioUrl.startsWith("blob:") ? currentProject.data.ttsAudioUrl : undefined
      }
      // 기존 프로젝트 업데이트 시: final이 없어도 기존 ttsAudioUrl 덮어쓰지 않음 (업로드 실패 시 유지)
      const ttsAudioUrlToSave =
        currentProject && !isNewProject
          ? (finalTtsAudioUrl !== undefined ? finalTtsAudioUrl : currentProject.data?.ttsAudioUrl)
          : finalTtsAudioUrl
      
      const projectData: ShoppingProjectData = {
        productName: productName ?? undefined,
        productDescription: productDescription ?? undefined,
        productImage: productImage !== null ? productImage : undefined,
        videoDuration,
        script,
        editedScript,
        selectedVoiceId,
        selectedSupertoneVoiceId,
        selectedSupertoneStyle,
        ttsAudioUrl: ttsAudioUrlToSave,
        imageUrls,
        imagePrompts,
        convertedVideoUrls: Array.from(convertedVideoUrls.entries()).map(([index, url]) => ({ index, videoUrl: url })),
        videoUrl,
        subtitleStyle,
        bgmUrl,
        bgmVolume,
        bgmStartTime,
        bgmEndTime,
        sfxUrl,
        sfxVolume,
        sfxStartTime,
        sfxEndTime,
        ttsVolume,
        transitionEffect,
        transitionDuration,
        youtubeTitle,
        youtubeDescription,
        youtubeTags,
        thumbnailUrl,
        thumbnailHookingText,
        thumbnailImages,
        selectedThumbnailIndex,
        activeStep,
        completedSteps: [],
      }

      if (currentProject && !isNewProject) {
        // 기존 프로젝트 업데이트
        await updateShoppingProject(currentProject.id, {
          name,
          description: newProjectDescription || undefined,
          data: projectData,
        })
        if (ttsAudioUrlToSave && !ttsAudioUrlToSave.startsWith("blob:")) {
          setTtsAudioUrl(ttsAudioUrlToSave)
        }
        alert("프로젝트가 저장되었습니다.")
      } else {
        // 새 프로젝트 생성 전에 모든 상태 초기화
        setProductName("")
        setProductDescription("")
        setProductImage(null)
        setProductImageFile(null)
        setScript("")
        setEditedScript("")
        setVideoUrl("")
        setImageUrls([])
        setImagePrompts([])
        setPromptsGenerated(false)
        setConvertedVideoUrls(new Map())
        setTtsAudioUrl("")
        setScenes([])
        setScriptLines([])
        setVideoDuration(12)
        setSelectedVoiceId("ttsmaker-여성1")
        setSelectedSupertoneVoiceId("")
        setSelectedSupertoneStyle("neutral")
        setSubtitleStyle({
          fontSize: 48,
          fontFamily: "Pretendard",
          color: "#FFFFFF",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          position: "center" as "top" | "center" | "bottom",
          positionOffset: 0,
          textAlign: "center" as "left" | "center" | "right",
          fontWeight: "bold" as "normal" | "bold",
          textShadow: true,
        })
        setBgmUrl("")
        setBgmFile(null)
        setBgmVolume(0.3)
        setBgmStartTime(0)
        setBgmEndTime(0)
        setSfxUrl("")
        setSfxFile(null)
        setSfxVolume(0.5)
        setSfxStartTime(0)
        setSfxEndTime(0)
        setTtsVolume(1.0)
        setTransitionEffect("fade")
        setTransitionDuration(0.5)
        setYoutubeTitle("")
        setYoutubeDescription("")
        setYoutubeTags([])
        setThumbnailUrl("")
        setThumbnailHookingText({ line1: "", line2: "" })
        setActiveStep("product")
        setError("")
        
        // 빈 데이터로 새 프로젝트 생성
        const emptyProjectData: ShoppingProjectData = {
          activeStep: "product",
        }
        
        const newProject = await createShoppingProject(
          userId,
          name,
          newProjectDescription || undefined,
          emptyProjectData
        )
        setCurrentProject(newProject) // 새 프로젝트로 전환
        
        // 새 프로젝트 생성 후 오디오가 임시 URL이면 업로드
        if (finalTtsAudioUrl && finalTtsAudioUrl.startsWith("blob:")) {
          try {
            console.log("[Shopping] 새 프로젝트 생성 후 오디오 파일 업로드 중...")
            const audioResponse = await fetch(finalTtsAudioUrl)
            const audioBlob = await audioResponse.blob()
            const uploadedAudioUrl = await uploadTTSAudio(audioBlob, newProject.id, userId)
            
            // 업로드된 URL로 프로젝트 업데이트
            await updateShoppingProject(newProject.id, {
              data: {
                ...projectData,
                ttsAudioUrl: uploadedAudioUrl,
              },
            })
            
            // 상태도 업데이트
            setTtsAudioUrl(uploadedAudioUrl)
            console.log("[Shopping] 새 프로젝트 오디오 파일 업로드 완료:", uploadedAudioUrl)
          } catch (uploadError) {
            console.error("[Shopping] 새 프로젝트 오디오 파일 업로드 실패:", uploadError)
          }
        }
        
        setShowCreateProjectDialog(false)
        setNewProjectName("")
        setNewProjectDescription("")
        setShowProjectList(false) // 프로젝트 목록 닫고 작업 화면으로 이동
      }
      
      await loadProjects()
    } catch (error) {
      console.error("프로젝트 저장 실패:", error)
      alert("프로젝트 저장에 실패했습니다.")
    } finally {
      setIsSavingProject(false)
    }
  }

  // 프로젝트 불러오기
  const loadProject = async (projectId: string) => {
    try {
      const project = await getShoppingProject(projectId)
      if (!project) {
        alert("프로젝트를 찾을 수 없습니다.")
        return
      }

      const data = project.data
      
      // 프로젝트 데이터 복원 (TTS 상태 포함)
      if (data.productName) setProductName(data.productName)
      if (data.productDescription) setProductDescription(data.productDescription)
      if (data.productImage) {
        setProductImage(data.productImage)
        // 이미지 비율 계산
        const img = new Image()
        img.onload = () => {
          const aspectRatio = img.width / img.height
          setProductImageAspectRatio(aspectRatio)
        }
        img.src = data.productImage
      }
      if (data.videoDuration) setVideoDuration(data.videoDuration)
      if (data.script) setScript(data.script)
      if (data.editedScript) setEditedScript(data.editedScript)
      if (data.selectedVoiceId) setSelectedVoiceId(data.selectedVoiceId)
      if (data.selectedSupertoneVoiceId) setSelectedSupertoneVoiceId(data.selectedSupertoneVoiceId)
      if (data.selectedSupertoneStyle) setSelectedSupertoneStyle(data.selectedSupertoneStyle)
      // TTS 오디오 URL 복원 (빈 문자열이 아닌 경우에만)
      setTtsAudioUrl(data.ttsAudioUrl && data.ttsAudioUrl.trim() ? data.ttsAudioUrl : "")
      if (data.imageUrls) setImageUrls(data.imageUrls)
      if (data.imagePrompts) {
        setImagePrompts(data.imagePrompts)
        setPromptsGenerated(data.imagePrompts.length > 0)
      }
      if (data.convertedVideoUrls) {
        const videoMap = new Map<number, string>()
        data.convertedVideoUrls.forEach(({ index, videoUrl }) => {
          videoMap.set(index, videoUrl)
        })
        setConvertedVideoUrls(videoMap)
      }
      if (data.videoUrl) setVideoUrl(data.videoUrl)
      if (data.subtitleStyle) setSubtitleStyle({
        ...data.subtitleStyle,
        positionOffset: data.subtitleStyle.positionOffset ?? 0, // 기본값 0
      })
      if (data.bgmUrl) setBgmUrl(data.bgmUrl)
      if (data.bgmVolume !== undefined) setBgmVolume(data.bgmVolume)
      if (data.bgmStartTime !== undefined) setBgmStartTime(data.bgmStartTime)
      if (data.bgmEndTime !== undefined) setBgmEndTime(data.bgmEndTime)
      if (data.sfxUrl) setSfxUrl(data.sfxUrl)
      if (data.sfxVolume !== undefined) setSfxVolume(data.sfxVolume)
      if (data.sfxStartTime !== undefined) setSfxStartTime(data.sfxStartTime)
      if (data.sfxEndTime !== undefined) setSfxEndTime(data.sfxEndTime)
      if (data.ttsVolume !== undefined) setTtsVolume(data.ttsVolume)
      if (data.transitionEffect) setTransitionEffect(data.transitionEffect)
      if (data.transitionDuration !== undefined) setTransitionDuration(data.transitionDuration)
      if (data.youtubeTitle) setYoutubeTitle(data.youtubeTitle)
      if (data.youtubeDescription) setYoutubeDescription(data.youtubeDescription)
      if (data.youtubeTags) setYoutubeTags(data.youtubeTags)
      if (data.thumbnailUrl) setThumbnailUrl(data.thumbnailUrl)
      if (data.thumbnailHookingText) setThumbnailHookingText(data.thumbnailHookingText)
      if (data.thumbnailImages) setThumbnailImages(data.thumbnailImages)
      if (data.selectedThumbnailIndex !== undefined) setSelectedThumbnailIndex(data.selectedThumbnailIndex)
      if (data.activeStep) setActiveStep(data.activeStep)

      setCurrentProject(project)
      setShowProjectList(false)
    } catch (error) {
      console.error("프로젝트 불러오기 실패:", error)
      alert("프로젝트를 불러오는데 실패했습니다.")
    }
  }

  // 프로젝트 삭제
  const handleDeleteProject = async (projectId: string) => {
    if (!confirm("정말 이 프로젝트를 삭제하시겠습니까?")) return

    try {
      await deleteShoppingProject(projectId)
      if (currentProject?.id === projectId) {
        setCurrentProject(null)
        setShowProjectList(true)
      }
      await loadProjects()
      alert("프로젝트가 삭제되었습니다.")
    } catch (error) {
      console.error("프로젝트 삭제 실패:", error)
      alert("프로젝트 삭제에 실패했습니다.")
    }
  }

  // 파일 처리 공통 함수
  const processImageFile = (file: File) => {
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
      const imageUrl = reader.result as string
      setProductImage(imageUrl)
      
      // 이미지 비율 계산
      const img = new Image()
      img.onload = () => {
        const aspectRatio = img.width / img.height
        setProductImageAspectRatio(aspectRatio)
        console.log(`[Shopping] 제품 이미지 비율: ${img.width}x${img.height} = ${aspectRatio.toFixed(2)}`)
      }
      img.src = imageUrl
    }
    reader.readAsDataURL(file)
  }

  // 이미지 업로드 처리
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    processImageFile(file)
  }

  // 드래그 앤 드롭 처리
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (!file) return
    processImageFile(file)
  }

  // 이미지 제거
  const handleRemoveImage = () => {
    setProductImage(null)
    setProductImageFile(null)
  }

  // 윙스봇 챗봇 메시지 전송 함수
  const handleChatbotSend = async () => {
    if (!chatbotInput.trim() || isChatbotGenerating) return

    const userMessage = chatbotInput.trim()
    setChatbotInput("")
    setChatbotMessages((prev) => [...prev, { type: "user", content: userMessage }])
    setIsChatbotGenerating(true)

    try {
      // WingsAIStudioShotForm 설정에서 OpenAI API 키 가져오기
      const apiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || null : null
      if (!apiKey) {
        setChatbotMessages((prev) => [...prev, {
          type: "assistant",
          content: "OpenAI API 키가 필요합니다. 설정에서 API 키를 입력해주세요."
        }])
        setIsChatbotGenerating(false)
        return
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "당신은 윙스봇입니다. WingsAIStudioShotForm의 AI 어시스턴트로서 사용자에게 친절하고 도움이 되는 답변을 제공합니다. 쇼핑 숏폼 영상 제작, 대본 작성, 이미지 생성, TTS 등에 대한 질문에 답변할 수 있습니다."
            },
            ...chatbotMessages.map((msg) => ({
              role: msg.type === "user" ? "user" : "assistant",
              content: msg.content
            })),
            { role: "user", content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || "응답 생성에 실패했습니다.")
      }

      const data = await response.json()
      const reply = data.choices[0]?.message?.content || "응답 생성에 실패했습니다."

      setChatbotMessages((prev) => [...prev, { type: "assistant", content: reply }])
    } catch (error) {
      console.error("챗봇 응답 생성 실패:", error)
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
      setChatbotMessages((prev) => [...prev, {
        type: "assistant",
        content: `죄송합니다. 오류가 발생했습니다: ${errorMessage}`
      }])
    } finally {
      setIsChatbotGenerating(false)
    }
  }

  // 대본 생성
  const handleGenerateScript = async () => {
    if (!productName.trim()) {
      alert("제품명을 입력해주세요.")
      return
    }

    const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined

    if (!openaiApiKey) {
      alert("OpenAI API 키가 필요합니다. 메인 화면의 설정(톱니바퀴 아이콘)에서 API 키를 입력해주세요.")
      return
    }

    setIsGeneratingScript(true)
    setError("")

    try {
      // 제품 설명이 있으면 그것을 기반으로, 없으면 제품명만 사용
      const scriptPrompt = productDescription.trim() 
        ? `${productName}. ${productDescription}` 
        : productName
      
      const generatedScript = await generateShoppingScript(
        productName,
        scriptPrompt,
        openaiApiKey,
        videoDuration
      )
      setScript(generatedScript)
      setEditedScript(generatedScript)
      setActiveStep("script")
      
      // 대본 생성 후 자동으로 파트 분석
      try {
        setIsAnalyzingScript(true)
        const parts = await analyzeScriptParts(generatedScript, openaiApiKey)
        setScriptParts(parts)
      } catch (error) {
        console.error("대본 분석 실패:", error)
        setScriptParts([])
      } finally {
        setIsAnalyzingScript(false)
      }
    } catch (error) {
      console.error("대본 생성 실패:", error)
      setError(`대본 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      setIsGeneratingScript(false)
    }
  }

  // 대본 편집 저장
  const handleSaveEditedScript = () => {
    setScript(editedScript)
    setIsEditingScript(false)
  }

  // BGM 파일 업로드
  const handleBgmUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("audio/")) {
      alert("오디오 파일만 업로드 가능합니다.")
      return
    }

    setBgmFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setBgmUrl(reader.result as string)
      
      // 기본 종료 시간을 10초로 설정
      setBgmEndTime(10)
    }
    reader.readAsDataURL(file)
  }

  // 효과음 파일 업로드
  const handleSfxUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("audio/")) {
      alert("오디오 파일만 업로드 가능합니다.")
      return
    }

    setSfxFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setSfxUrl(reader.result as string)
      
      // 파일 크기 확인 및 기본 종료 시간 설정
      const audio = new Audio(reader.result as string)
      audio.onloadedmetadata = () => {
        if (sfxEndTime === 0 || sfxEndTime > audio.duration) {
          setSfxEndTime(audio.duration)
        }
      }
    }
    reader.readAsDataURL(file)
  }

  // 오디오 라이브러리에서 BGM 선택
  const handleSelectBgmFromLibrary = (audioItem: AudioLibraryItem) => {
    setBgmUrl(audioItem.url)
    setBgmFile(null) // 라이브러리에서 선택한 경우 파일은 null
    
    // 기본 종료 시간을 10초로 설정
    setBgmEndTime(10)
    setShowBgmLibraryDialog(false)
  }

  // BGM 삭제
  const handleDeleteBgm = () => {
    // BGM 정리
    if (previewBgmAudio) {
      previewBgmAudio.pause()
      previewBgmAudio.currentTime = 0
      previewBgmAudio.src = ""
      previewBgmAudio.load()
      setPreviewBgmAudio(null)
    }
    
    // 상태 초기화
    setBgmUrl("")
    setBgmFile(null)
    setBgmVolume(0.3)
    setBgmStartTime(0)
    setBgmEndTime(0)
  }

  // 오디오 라이브러리에서 효과음 선택
  const handleSelectSfxFromLibrary = (audioItem: AudioLibraryItem) => {
    setSfxUrl(audioItem.url)
    setSfxFile(null) // 라이브러리에서 선택한 경우 파일은 null
    
    // 오디오 길이 확인
    const audio = new Audio(audioItem.url)
    audio.onloadedmetadata = () => {
      if (sfxEndTime === 0 || sfxEndTime > audio.duration) {
        setSfxEndTime(audio.duration)
      }
    }
    setShowSfxLibraryDialog(false)
  }

  // 제목/설명/태그 자동 생성
  const handleGenerateMetadata = async () => {
    if (!script.trim()) {
      alert("대본이 없습니다. 먼저 대본을 생성해주세요.")
      return
    }

    const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined

    if (!openaiApiKey) {
      alert("OpenAI API 키가 필요합니다.")
      return
    }

    setIsGeneratingMetadata(true)
    try {
      const metadata = await generateYouTubeMetadata(
        productName,
        productDescription || productName,
        script,
        openaiApiKey
      )
      setYoutubeTitle(metadata.title)
      setYoutubeDescription(metadata.description)
      setYoutubeTags(metadata.tags)
    } catch (error) {
      console.error("메타데이터 생성 실패:", error)
      alert(`메타데이터 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      setIsGeneratingMetadata(false)
    }
  }

  // 수퍼톤 음성 목록 가져오기
  const fetchSupertoneVoices = async () => {
    setIsLoadingSupertoneVoices(true)
    try {
      // WingsAIStudioShotForm 설정창에서만 API 키 가져오기
      const supertoneApiKey = typeof window !== "undefined" 
        ? (localStorage.getItem("shotform_supertone_api_key") || "").trim() 
        : null
      if (!supertoneApiKey || supertoneApiKey.length === 0) {
        alert("수퍼톤 API 키가 필요합니다. 설정에서 API 키를 입력해주세요.\n\n수퍼톤 API 콘솔(console.supertoneapi.com)에서 API 키를 발급받을 수 있습니다.")
        setIsLoadingSupertoneVoices(false)
        return
      }

      // API 키 형식 검증
      if (supertoneApiKey.length < 20) {
        alert(`수퍼톤 API 키 형식이 올바르지 않습니다. (길이: ${supertoneApiKey.length}자)\n\n수퍼톤 API 콘솔(console.supertoneapi.com)에서 올바른 API 키를 확인하고 다시 입력해주세요.`)
        setIsLoadingSupertoneVoices(false)
        return
      }

      const response = await fetch(`/api/supertone-voices?apiKey=${encodeURIComponent(supertoneApiKey)}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "음성 목록을 가져오는데 실패했습니다.")
      }

      const data = await response.json()
      if (data.success && data.voices) {
        const excludedNames = ["달팽이A", "기억의정령_알마냐", "틈새의정령_알마냐"]
        const filteredVoices = data.voices.filter((voice: { name: string }) => 
          !excludedNames.some(excluded => voice.name.includes(excluded))
        )
        setSupertoneVoices(filteredVoices)
        if (filteredVoices.length > 0 && !selectedSupertoneVoiceId) {
          setSelectedSupertoneVoiceId(filteredVoices[0].voice_id)
          setSelectedVoiceId(`supertone-${filteredVoices[0].voice_id}`)
        }
      } else {
        throw new Error(data.error || "음성 목록을 가져오는데 실패했습니다.")
      }
    } catch (error) {
      console.error("수퍼톤 음성 목록 가져오기 실패:", error)
      alert(`수퍼톤 음성 목록을 가져오는데 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      setIsLoadingSupertoneVoices(false)
    }
  }

  // 목소리 미리듣기 함수
  const handlePreviewVoice = async (voiceId: string) => {
    setPreviewingVoiceId(voiceId)
    
    try {
      let response: Response
      
      if (voiceId?.startsWith("supertone-")) {
        const actualVoiceId = voiceId.replace("supertone-", "")
        // WingsAIStudioShotForm 설정창에서만 API 키 가져오기
        const supertoneApiKey = typeof window !== "undefined" 
          ? (localStorage.getItem("shotform_supertone_api_key") || "").trim() 
          : null
        
        if (!supertoneApiKey) {
          alert("수퍼톤 API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
          setPreviewingVoiceId(null)
          return
        }
        
        response = await fetch("/api/supertone-tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: "여러분 환영합니다",
            voiceId: actualVoiceId,
            apiKey: supertoneApiKey,
            style: selectedSupertoneStyle || "neutral",
            language: "ko",
          }),
        })
      } else if (voiceId?.startsWith("ttsmaker-")) {
        const voiceName = voiceId.replace("ttsmaker-", "")
        const pitch = voiceName === "남성5" ? 0.9 : 1.0
        const ttsmakerApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_ttsmaker_api_key") || undefined : undefined

        if (!ttsmakerApiKey) {
          alert("TTSMaker API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
          setPreviewingVoiceId(null)
          return
        }
        
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
            apiKey: ttsmakerApiKey,
          }),
        })
      } else if (voiceId?.startsWith("elevenlabs-")) {
        // ElevenLabs인 경우 - 접두사 제거
        const cleanVoiceId = voiceId.replace("elevenlabs-", "")
        // WingsAIStudioShotForm 설정창에서만 API 키 가져오기
        let elevenlabsApiKey = typeof window !== "undefined" 
          ? (localStorage.getItem("shotform_elevenlabs_api_key") || "").trim() 
          : null
        
        if (!elevenlabsApiKey || elevenlabsApiKey.length === 0) {
          alert("ElevenLabs API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
          setPreviewingVoiceId(null)
          return
        }
        
        response = await fetch("/api/elevenlabs-tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: "여러분 환영합니다",
            voiceId: cleanVoiceId, // 접두사 제거된 순수 Voice ID
            apiKey: elevenlabsApiKey,
          }),
        })
      } else {
        // 기본 TTSMaker 처리 (접두사 없는 경우)
        const voiceName = voiceId.replace("ttsmaker-", "") || "여성1"
        const pitch = voiceName === "남성5" ? 0.9 : 1.0
        const ttsmakerApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_ttsmaker_api_key") || undefined : undefined

        if (!ttsmakerApiKey) {
          alert("TTSMaker API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
          setPreviewingVoiceId(null)
          return
        }
        
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
            apiKey: ttsmakerApiKey,
          }),
        })
      }

      if (!response.ok) {
        let errorMessage = "미리듣기 실패"
        try {
          const clonedResponse = response.clone()
          const errorData = await clonedResponse.json()
          errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`
        } catch (e) {
          try {
            const errorText = await response.text()
            errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`
          } catch (textError) {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`
          }
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

  // TTS 생성 (3개 장면 전체 대본) - 이미지 생성보다 먼저
  const handleGenerateTTS = async () => {
    if (!script.trim()) {
      alert("대본이 없습니다.")
      return
    }

    // 재생성 시 기존 오디오 URL 초기화
    if (ttsAudioUrl) {
      // Blob URL인 경우 메모리 해제
      if (ttsAudioUrl.startsWith("blob:")) {
        URL.revokeObjectURL(ttsAudioUrl)
      }
      setTtsAudioUrl("")
    }

    setIsGeneratingTTS(true)
    setTtsProgress({ current: 0, total: 1 })
    setError("")

    try {
      // 전체 대본을 한 번에 TTS 생성 (대본 그대로 사용 - 절대 끊기면 안됨)
      console.log("[Shopping] TTS 생성 중... (목소리:", selectedVoiceId, ")")
      console.log("[Shopping] 대본 전체 길이:", script.length, "자")
      console.log("[Shopping] 대본 전체 내용:", script)
      
      // 대본을 그대로 사용 (전처리 없이 원본 그대로)
      // 절대 대본을 수정하거나 자르지 않음
      const ttsText = script.trim()
      
      console.log("[Shopping] TTS에 전달할 대본 길이:", ttsText.length, "자")
      console.log("[Shopping] TTS에 전달할 대본 내용:", ttsText)
      
      let response: Response
      
      // TTSMaker인 경우
      if (selectedVoiceId?.startsWith("ttsmaker-")) {
        const voiceName = selectedVoiceId.replace("ttsmaker-", "")
        const pitch = voiceName === "남성5" ? 0.9 : 1.0
        const ttsmakerApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_ttsmaker_api_key") || undefined : undefined
        
        if (!ttsmakerApiKey) {
          alert("TTSMaker API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
          setIsGeneratingTTS(false)
          return
        }
        
        response = await fetch("/api/ttsmaker", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: ttsText,
            voice: voiceName,
            speed: 1.0,
            pitch: pitch,
            apiKey: ttsmakerApiKey,
          }),
        })
      } else if (selectedVoiceId?.startsWith("supertone-")) {
        // 수퍼톤인 경우
        const voiceId = selectedVoiceId.replace("supertone-", "")
        // WingsAIStudioShotForm 설정창에서만 API 키 가져오기
        const supertoneApiKey = typeof window !== "undefined" 
          ? (localStorage.getItem("shotform_supertone_api_key") || "").trim() 
          : null
        
        if (!supertoneApiKey) {
          alert("수퍼톤 API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
          setIsGeneratingTTS(false)
          return
        }
        
        response = await fetch("/api/supertone-tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: ttsText,
            voiceId: voiceId,
            apiKey: supertoneApiKey,
            style: selectedSupertoneStyle || "neutral",
            language: "ko",
          }),
        })
      } else if (selectedVoiceId?.startsWith("elevenlabs-")) {
        // ElevenLabs인 경우
        const voiceId = selectedVoiceId.replace("elevenlabs-", "") // 접두사 제거
        // WingsAIStudioShotForm 설정창에서만 API 키 가져오기
        const elevenlabsApiKey = typeof window !== "undefined" 
          ? (localStorage.getItem("shotform_elevenlabs_api_key") || "").trim() 
          : null

        if (!elevenlabsApiKey || elevenlabsApiKey.length === 0) {
          alert("ElevenLabs API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
          setIsGeneratingTTS(false)
          return
        }
        
        response = await fetch("/api/elevenlabs-tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: ttsText, // 원본 대본 그대로 사용 (절대 수정하지 않음)
            voiceId: voiceId, // 접두사 제거된 순수 Voice ID
            apiKey: elevenlabsApiKey,
          }),
        })
      } else {
        // TTSMaker인 경우 (기본)
        const voiceName = selectedVoiceId.replace("ttsmaker-", "")
        const pitch = voiceName === "남성5" ? 0.9 : 1.0
        const ttsmakerApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_ttsmaker_api_key") || undefined : undefined

        if (!ttsmakerApiKey) {
          alert("TTSMaker API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
          setIsGeneratingTTS(false)
          return
        }

        response = await fetch("/api/ttsmaker-tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: ttsText,
            voiceId: voiceName === "여성1" ? 503 : voiceName === "여성2" ? 509 : voiceName === "여성6" ? 5802 : voiceName === "남성1" ? 5501 : voiceName === "남성4" ? 5888 : 5888,
            pitch: pitch,
            apiKey: ttsmakerApiKey,
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
      
      // 실제 오디오 길이 (원본 그대로) 사용
      const actualAudioDuration = originalDuration
      
      // 임시 URL 생성 (미리듣기용)
      const tempAudioUrl = URL.createObjectURL(processedBlob)
      console.log("[Shopping] 임시 오디오 URL 생성:", tempAudioUrl)
      
      // Supabase Storage에 오디오 파일 업로드 (영구 저장)
      let permanentAudioUrl = tempAudioUrl // 기본값: 임시 URL
      try {
        if (userId && currentProject?.id) {
          console.log("[Shopping] 오디오 파일을 Supabase Storage에 업로드 중...")
          permanentAudioUrl = await uploadTTSAudio(processedBlob, currentProject.id, userId)
          console.log("[Shopping] 오디오 파일 업로드 완료:", permanentAudioUrl)
        } else {
          console.warn("[Shopping] 프로젝트가 없어 오디오 파일을 업로드하지 않습니다. 프로젝트를 먼저 저장해주세요.")
        }
      } catch (uploadError) {
        console.error("[Shopping] 오디오 파일 업로드 실패:", uploadError)
        // 업로드 실패해도 임시 URL 사용 (사용자 경험 유지)
      }
      
      // TTS 오디오 URL 설정 (영구 URL 우선, 없으면 임시 URL)
      setTtsAudioUrl(permanentAudioUrl)
      console.log("[Shopping] TTS 오디오 URL 설정 완료:", permanentAudioUrl ? "있음" : "없음")
      
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
  // 이미지 생성 단계로 이동 (실제 생성은 하지 않음)
  const handleGoToImageGeneration = () => {
    if (!script.trim()) {
      alert("대본이 생성되지 않았습니다.")
      return
    }
    setActiveStep("video")
    // 프롬프트 초기화
    setImagePrompts([])
    setPromptsGenerated(false)
    // 영상 생성 상태 초기화 (단계 전환 시)
    setIsConvertingToVideo(new Map())
  }

  // 이미지 프롬프트 생성 함수
  const handleGenerateImagePrompts = async () => {
    if (!script.trim()) {
      alert("대본이 생성되지 않았습니다.")
      return
    }

    const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined

    if (!openaiApiKey) {
      alert("OpenAI API 키가 필요합니다. 메인 화면의 설정(톱니바퀴 아이콘)에서 API 키를 입력해주세요.")
      return
    }

    setIsGeneratingPrompts(true)
    setError("")

    try {
      // 이미지를 base64로 변환 (있는 경우)
      let imageBase64: string | undefined = undefined
      if (productImage) {
        imageBase64 = productImage
      }

      // 대본 전체를 분석하여 이미지 프롬프트 생성 (1개 이미지용)
      const prompts = await generateImagePromptsFromScript(
        script, // 대본 전체 전달
        productName,
        productDescription || "",
        imageBase64,
        openaiApiKey
      )
      
      setImagePrompts(prompts)
      setPromptsGenerated(true)
    } catch (error) {
      console.error("프롬프트 생성 실패:", error)
      setError(`프롬프트 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      setIsGeneratingPrompts(false)
    }
  }

  // 실제 이미지 생성 함수 (프롬프트 사용)
  const handleGenerateImage = async () => {
    if (!script.trim()) {
      alert("대본이 생성되지 않았습니다.")
      return
    }

    if (!promptsGenerated || imagePrompts.length === 0) {
      alert("먼저 이미지 프롬프트를 생성해주세요.")
      return
    }

    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined

    if (!replicateApiKey) {
      alert("Replicate API 키가 필요합니다. 메인 화면의 설정(톱니바퀴 아이콘)에서 API 키를 입력해주세요.")
      return
    }

    setIsGeneratingVideo(true)
    setError("")
    setImageUrls([]) // 재생성 시 기존 이미지 초기화
    setGenerationProgress({ current: 0, total: 3 })

    try {
      // 이미지를 base64로 변환 (있는 경우)
      let imageBase64: string | undefined = undefined
      let imageAspectRatio: string | undefined = undefined
      
      if (productImage) {
        imageBase64 = productImage
        
        // 원본 이미지 비율 계산
        try {
          const img = new Image()
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              const width = img.width
              const height = img.height
              const ratio = width / height
              
              // 비율에 따라 적절한 aspect_ratio 설정
              if (Math.abs(ratio - 1) < 0.1) {
                // 1:1 (정사각형)
                imageAspectRatio = "1:1"
              } else if (ratio > 1.2) {
                // 가로가 더 긴 경우
                imageAspectRatio = "16:9"
              } else if (ratio < 0.7) {
                // 세로가 더 긴 경우
                imageAspectRatio = "9:16"
              } else {
                // 중간 비율
                imageAspectRatio = ratio > 1 ? "4:3" : "3:4"
              }
              console.log(`[Shopping] 원본 이미지 비율 계산: ${width}x${height} = ${ratio.toFixed(2)}, aspect_ratio: ${imageAspectRatio}`)
              resolve()
            }
            img.onerror = () => {
              console.warn("[Shopping] 이미지 비율 계산 실패, 기본값 9:16 사용")
              imageAspectRatio = "9:16"
              resolve()
            }
            img.src = productImage
          })
        } catch (error) {
          console.error("[Shopping] 이미지 비율 계산 중 오류:", error)
          imageAspectRatio = "9:16" // 기본값
        }
      }

      // 프롬프트를 사용하여 3장의 이미지 생성
      const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined
      
      const imageUrls = await generateImage(script, productName, replicateApiKey, imageBase64, productDescription, openaiApiKey, imagePrompts, imageAspectRatio)
      
      setImageUrls(imageUrls)
      setGenerationProgress({ current: 3, total: 3 })
      // 이미지 생성 완료 후에도 "video" 단계에 머물러서 원본과 생성된 이미지를 비교할 수 있도록 함
    } catch (error) {
      console.error("이미지 생성 실패:", error)
      setError(`이미지 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      setIsGeneratingVideo(false)
      setGenerationProgress({ current: 0, total: 1 })
    }
  }

  // 개별 이미지 재생성 함수
  const handleRegenerateSingleImage = async (index: 0 | 1 | 2) => {
    // 즉시 로딩 상태 설정 (버튼 클릭 시 바로 로딩 표시)
    setIsRegeneratingImage((prev) => {
      const newMap = new Map(prev)
      newMap.set(index, true)
      return newMap
    })
    
    if (!script.trim()) {
      alert("대본이 생성되지 않았습니다.")
      setIsRegeneratingImage((prev) => {
        const newMap = new Map(prev)
        newMap.set(index, false)
        return newMap
      })
      return
    }

    if (!promptsGenerated || imagePrompts.length === 0) {
      alert("먼저 이미지 프롬프트를 생성해주세요.")
      setIsRegeneratingImage((prev) => {
        const newMap = new Map(prev)
        newMap.set(index, false)
        return newMap
      })
      return
    }

    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined

    if (!replicateApiKey) {
      alert("Replicate API 키가 필요합니다. 메인 화면의 설정(톱니바퀴 아이콘)에서 API 키를 입력해주세요.")
      setIsRegeneratingImage((prev) => {
        const newMap = new Map(prev)
        newMap.set(index, false)
        return newMap
      })
      return
    }

    const sceneNames = ["제품 전체 샷", "제품 디테일 샷", "다른 배경 샷"]
    
    try {
      setError("")
      
      console.log(`[Shopping] 🖼️ ${sceneNames[index]} 재생성 시작`)
      
      // 이미지를 base64로 변환 (있는 경우)
      let imageBase64: string | undefined = undefined
      let imageAspectRatio: string | undefined = undefined
      
      if (productImage) {
        imageBase64 = productImage
        
        // 원본 이미지 비율 계산
        try {
          const img = new Image()
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              const width = img.width
              const height = img.height
              const ratio = width / height
              
              // 비율에 따라 적절한 aspect_ratio 설정
              if (Math.abs(ratio - 1) < 0.1) {
                imageAspectRatio = "1:1"
              } else if (ratio > 1.2) {
                imageAspectRatio = "16:9"
              } else if (ratio < 0.7) {
                imageAspectRatio = "9:16"
              } else {
                imageAspectRatio = ratio > 1 ? "4:3" : "3:4"
              }
              resolve()
            }
            img.onerror = () => {
              imageAspectRatio = "9:16"
              resolve()
            }
            img.src = productImage
          })
        } catch (error) {
          console.error("[Shopping] 이미지 비율 계산 중 오류:", error)
          imageAspectRatio = "9:16"
        }
      }

      // 해당 인덱스의 프롬프트로 이미지 재생성
      const prompt = imagePrompts[index]
      
      // 추가 프롬프트가 있으면 AI를 통해 프롬프트 재작성
      const customPrompt = customImagePrompts.get(index)
      let finalPrompt = prompt.prompt
      
      if (customPrompt && customPrompt.trim()) {
        console.log(`[Shopping] 추가 프롬프트 감지, AI를 통해 프롬프트 재작성 시작: ${customPrompt}`)
        
        const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined
        
        if (openaiApiKey) {
          // AI를 통해 프롬프트 재작성
          finalPrompt = await refineImagePromptWithCustomInput(
            prompt.prompt,
            customPrompt,
            productName,
            productDescription,
            openaiApiKey
          )
          console.log(`[Shopping] ✅ AI가 재작성한 프롬프트: ${finalPrompt.substring(0, 100)}...`)
        } else {
          // API 키가 없으면 단순히 연결
          finalPrompt = `${prompt.prompt}, ${customPrompt.trim()}`
          console.log(`[Shopping] OpenAI API 키 없음, 단순 연결 사용`)
        }
      }
      
      const imageUrl = await generateImageWithNanobanana(
        finalPrompt,
        productName,
        imageBase64,
        replicateApiKey,
        index, // sceneIndex
        productDescription,
        imageAspectRatio
      )
      
      console.log(`[Shopping] ✅ ${sceneNames[index]} 재생성 완료:`, imageUrl)
      
      // 재생성된 이미지 URL 업데이트
      setImageUrls((prev) => {
        const newUrls = [...prev]
        newUrls[index] = imageUrl
        return newUrls
      })
      
      // 해당 인덱스의 영상이 있다면 초기화 (이미지가 변경되었으므로)
      setConvertedVideoUrls((prev) => {
        const newMap = new Map(prev)
        newMap.delete(index)
        return newMap
      })
      
    } catch (error) {
      console.error(`[Shopping] ❌ ${sceneNames[index]} 재생성 실패:`, error)
      setError(`이미지 재생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      // 상태 업데이트
      setIsRegeneratingImage((prev) => {
        const newMap = new Map(prev)
        newMap.set(index, false)
        return newMap
      })
    }
  }

  // 미리보기 버튼 클릭 시 영상 생성 및 미리보기 준비 (레거시 - 사용 안 함)
  const handleGenerateVideoFromImage = async () => {
    // 이 함수는 더 이상 사용하지 않음
    // handleConvertAllImagesToVideos를 사용해야 함
    alert("이미지 영상 변환 기능을 사용해주세요.")
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
      
      // 캔버스에 첫 프레임 그리기 (비율 유지)
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = 1080
        canvas.height = 1920
        const ctx = canvas.getContext("2d")
        if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
          const videoWidth = video.videoWidth
          const videoHeight = video.videoHeight
          const canvasWidth = canvas.width
          const canvasHeight = canvas.height
          
          // 비디오와 캔버스의 비율 계산
          const videoAspect = videoWidth / videoHeight
          const canvasAspect = canvasWidth / canvasHeight
          
          let drawWidth = canvasWidth
          let drawHeight = canvasHeight
          let drawX = 0
          let drawY = 0
          
          // 비율에 맞춰 중앙 크롭 (cover 방식)
          if (videoAspect > canvasAspect) {
            // 비디오가 더 넓음 - 높이에 맞추고 좌우 크롭
            drawHeight = canvasHeight
            drawWidth = drawHeight * videoAspect
            drawX = (canvasWidth - drawWidth) / 2
          } else {
            // 비디오가 더 높음 - 너비에 맞추고 상하 크롭
            drawWidth = canvasWidth
            drawHeight = drawWidth / videoAspect
            drawY = (canvasHeight - drawHeight) / 2
          }
          
          ctx.drawImage(video, 0, 0, videoWidth, videoHeight, drawX, drawY, drawWidth, drawHeight)
        }
      }
      
      console.log("[Shopping] 미리보기 준비 완료")
    } catch (error) {
      console.error("[Shopping] 미리보기 준비 실패:", error)
      setError(`미리보기 준비에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    }
  }

  // 썸네일 생성 (AI)
  const handleGenerateThumbnail = async () => {
    if (!productName) {
      alert("제품명이 필요합니다.")
      return
    }

    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined
    const gptApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined

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
      const hookingText = await generateThumbnailHookingText(productName, gptApiKey)
      setThumbnailHookingText(hookingText)

      // 2. 제품 이미지 확인
      if (!imageBase64) {
        throw new Error("제품 이미지가 필요합니다.")
      }

      // 3. 나노바나나로 썸네일 생성 (제품 이미지 + 텍스트 포함)
      const thumbnail = await generateShortsThumbnail(productName, replicateApiKey, imageBase64, hookingText)
      
      // 4. 썸네일 목록에 추가
      const newThumbnail = {
        url: thumbnail,
        text: hookingText,
        isCustom: false
      }
      setThumbnailImages(prev => [...prev, newThumbnail])
      setSelectedThumbnailIndex(thumbnailImages.length)
      setThumbnailUrl(thumbnail)

      // 5. 생성된 썸네일을 캔버스에 표시 (AI 생성 썸네일은 이미 텍스트가 포함되어 있으므로 그대로 표시)
      setTimeout(() => {
        if (thumbnailCanvasRef.current) {
          const canvas = thumbnailCanvasRef.current
          const ctx = canvas.getContext("2d")
          if (ctx) {
            canvas.width = 1080
            canvas.height = 1920
            const img = new Image()
            img.crossOrigin = "anonymous"
            img.src = thumbnail
            img.onload = () => {
              // 비율 유지하며 그리기
              const imgAspect = img.width / img.height
              const canvasAspect = canvas.width / canvas.height
              
              let drawWidth: number
              let drawHeight: number
              let offsetX: number
              let offsetY: number
              
              if (imgAspect > canvasAspect) {
                // 이미지가 더 넓음 - 높이에 맞추고 좌우 크롭
                drawHeight = canvas.height
                drawWidth = drawHeight * imgAspect
                offsetX = (canvas.width - drawWidth) / 2
                offsetY = 0
              } else {
                // 이미지가 더 높음 - 너비에 맞추고 상하 크롭
                drawWidth = canvas.width
                drawHeight = drawWidth / imgAspect
                offsetX = 0
                offsetY = (canvas.height - drawHeight) / 2
              }
              
              // 검은 배경으로 채우기
              ctx.fillStyle = "black"
              ctx.fillRect(0, 0, canvas.width, canvas.height)
              
              // 이미지 그리기 (비율 유지)
              ctx.drawImage(img, 0, 0, img.width, img.height, offsetX, offsetY, drawWidth, drawHeight)
            }
          }
        }
      }, 100)
    } catch (error) {
      console.error("썸네일 생성 실패:", error)
      setError(`썸네일 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      setIsGeneratingThumbnail(false)
    }
  }

  // 직접 썸네일 이미지 업로드
  const handleCustomThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드 가능합니다.")
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string
      setCustomThumbnailImage(imageUrl)
      
      // 후킹 문구 자동 생성 (선택사항)
      if (!customThumbnailText.line1) {
        const gptApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined
        if (gptApiKey) {
          generateThumbnailHookingText(productName, gptApiKey).then(text => {
            setCustomThumbnailText(text)
          }).catch(() => {
            // 실패해도 계속 진행
          })
        }
      }
    }
    reader.readAsDataURL(file)
  }

  // 이미지 생성 단계에서 생성한 이미지 선택
  const handleSelectGeneratedImage = (imageUrl: string) => {
    setCustomThumbnailImage(imageUrl)
    
    // 후킹 문구 자동 생성 (선택사항)
    if (!customThumbnailText.line1) {
      const gptApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined
      if (gptApiKey) {
        generateThumbnailHookingText(productName, gptApiKey).then(text => {
          setCustomThumbnailText(text)
        }).catch(() => {
          // 실패해도 계속 진행
        })
      }
    }
  }

  // 직접 생성한 썸네일에 텍스트 추가 및 저장
  const handleSaveCustomThumbnail = () => {
    if (!customThumbnailImage) {
      alert("이미지를 업로드해주세요.")
      return
    }

    if (!customThumbnailText.line1 || !customThumbnailText.line2) {
      alert("텍스트를 입력해주세요.")
      return
    }

    // 캔버스에 이미지와 텍스트 그리기
    renderThumbnailWithText(customThumbnailImage, customThumbnailText).then(() => {
      // 캔버스에서 데이터 URL 가져오기
      if (thumbnailCanvasRef.current) {
        const dataUrl = thumbnailCanvasRef.current.toDataURL("image/png")
        
        // 썸네일 목록에 추가
        const newThumbnail = {
          url: dataUrl,
          text: customThumbnailText,
          isCustom: true
        }
        setThumbnailImages(prev => [...prev, newThumbnail])
        setSelectedThumbnailIndex(thumbnailImages.length)
        setThumbnailUrl(dataUrl)
        
        // 초기화
        setCustomThumbnailImage("")
        setCustomThumbnailText({ line1: "", line2: "" })
      }
    })
  }

  // 썸네일 선택
  const handleSelectThumbnail = (index: number) => {
    setSelectedThumbnailIndex(index)
    const selected = thumbnailImages[index]
    if (selected) {
      setThumbnailUrl(selected.url)
      setThumbnailHookingText(selected.text)
      
      // AI 생성 썸네일은 이미 텍스트가 포함되어 있으므로 그대로 표시
      if (!selected.isCustom) {
        if (thumbnailCanvasRef.current) {
          const canvas = thumbnailCanvasRef.current
          const ctx = canvas.getContext("2d")
          if (ctx) {
            canvas.width = 1080
            canvas.height = 1920
            const img = new Image()
            img.crossOrigin = "anonymous"
            img.src = selected.url
            img.onload = () => {
              // 비율 유지하며 그리기
              const imgAspect = img.width / img.height
              const canvasAspect = canvas.width / canvas.height
              
              let drawWidth: number
              let drawHeight: number
              let offsetX: number
              let offsetY: number
              
              if (imgAspect > canvasAspect) {
                // 이미지가 더 넓음 - 높이에 맞추고 좌우 크롭
                drawHeight = canvas.height
                drawWidth = drawHeight * imgAspect
                offsetX = (canvas.width - drawWidth) / 2
                offsetY = 0
              } else {
                // 이미지가 더 높음 - 너비에 맞추고 상하 크롭
                drawWidth = canvas.width
                drawHeight = drawWidth / imgAspect
                offsetX = 0
                offsetY = (canvas.height - drawHeight) / 2
              }
              
              // 검은 배경으로 채우기
              ctx.fillStyle = "black"
              ctx.fillRect(0, 0, canvas.width, canvas.height)
              
              // 이미지 그리기 (비율 유지)
              ctx.drawImage(img, 0, 0, img.width, img.height, offsetX, offsetY, drawWidth, drawHeight)
            }
          }
        }
      } else {
        // 직접 생성 썸네일은 텍스트를 렌더링
        renderThumbnailWithText(selected.url, selected.text)
      }
    }
  }

  // 썸네일에 텍스트 렌더링
  const renderThumbnailWithText = async (imageUrl: string, hookingText: { line1: string; line2: string }): Promise<void> => {
    return new Promise((resolve) => {
      const canvas = thumbnailCanvasRef.current
      if (!canvas) {
        resolve()
        return
      }

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        resolve()
        return
      }

      // 캔버스 크기 설정 (9:16 비율)
      canvas.width = 1080
      canvas.height = 1920

      // 이미지 로드
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.src = imageUrl

      img.onload = () => {
        // 배경 이미지 그리기 (비율 유지하며 확대 - cover 방식)
        const imgAspect = img.width / img.height
        const canvasAspect = canvas.width / canvas.height
        
        // 이미지 스케일 적용
        let drawWidth: number
        let drawHeight: number
        let offsetX: number
        let offsetY: number
        
        // 비율을 유지하면서 확대 (cover 방식)
        if (imgAspect > canvasAspect) {
          // 이미지가 더 넓음 - 높이에 맞추고 좌우 크롭
          drawHeight = canvas.height * customThumbnailTextStyle.imageScale
          drawWidth = drawHeight * imgAspect
          offsetX = (canvas.width - drawWidth) / 2
          offsetY = (canvas.height - drawHeight) / 2
        } else {
          // 이미지가 더 높음 - 너비에 맞추고 상하 크롭
          drawWidth = canvas.width * customThumbnailTextStyle.imageScale
          drawHeight = drawWidth / imgAspect
          offsetX = (canvas.width - drawWidth) / 2
          offsetY = (canvas.height - drawHeight) / 2
        }
        
        // 검은 배경으로 채우기
        ctx.fillStyle = "black"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        // 이미지 그리기 (비율 유지)
        ctx.drawImage(img, 0, 0, img.width, img.height, offsetX, offsetY, drawWidth, drawHeight)

        // 텍스트 위치 (사용자 설정에 따라)
        const textY = canvas.height * customThumbnailTextStyle.position
        const textX = canvas.width / 2

        // 첫 번째 줄 스타일 (글씨 크기: customThumbnailTextStyle.fontSize)
        const fontSize = customThumbnailTextStyle.fontSize ?? 100
        ctx.font = `bold ${fontSize}px 'Noto Sans KR', Arial, sans-serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        
        // 첫 번째 줄 회전 적용
        ctx.save()
        ctx.translate(textX, textY)
        ctx.rotate((customThumbnailTextStyle.textRotation * Math.PI) / 180)
        
        // 첫 번째 줄 테두리
        if (customThumbnailTextStyle.strokeWidth > 0) {
          ctx.strokeStyle = customThumbnailTextStyle.strokeColor
          ctx.lineWidth = customThumbnailTextStyle.strokeWidth
          ctx.lineJoin = "round"
          ctx.strokeText(hookingText.line1, 0, 0)
        }
        
        // 첫 번째 줄 텍스트
        ctx.fillStyle = customThumbnailTextStyle.line1Color
        ctx.fillText(hookingText.line1, 0, 0)
        ctx.restore()

        // 두 번째 줄 스타일 (첫 줄과 동일 크기, 줄 간격은 글씨 크기의 1.2배)
        const textY2 = textY + fontSize * 1.2
        
        // 두 번째 줄 회전 적용
        ctx.save()
        ctx.translate(textX, textY2)
        ctx.rotate((customThumbnailTextStyle.textRotation * Math.PI) / 180)
        
        // 두 번째 줄 테두리
        if (customThumbnailTextStyle.strokeWidth > 0) {
          ctx.strokeStyle = customThumbnailTextStyle.strokeColor
          ctx.lineWidth = customThumbnailTextStyle.strokeWidth
          ctx.strokeText(hookingText.line2, 0, 0)
        }
        
        // 두 번째 줄 텍스트
        ctx.fillStyle = customThumbnailTextStyle.line2Color
        ctx.fillText(hookingText.line2, 0, 0)
        ctx.restore()
        
        resolve()
      }

      img.onerror = () => {
        resolve()
      }
    })
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
      let audio: HTMLAudioElement | null = previewAudio
      let bgmAudio: HTMLAudioElement | null = null
      let videoElements = previewVideoElements

      // 오디오가 없거나 유효하지 않으면 새로 로드
      if (!audio || !audio.duration || isNaN(audio.duration)) {
        console.log("[Shopping] 오디오 새로 로드")
        const audioResponse = await fetch(ttsAudioUrl)
        const audioBlob = await audioResponse.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        audio = new Audio(audioUrl)
        audio.volume = ttsVolume // TTS 볼륨 설정

        await new Promise<void>((resolve, reject) => {
          if (!audio) {
            reject(new Error("오디오 생성 실패"))
            return
          }
          audio.onloadeddata = () => resolve()
          audio.onerror = reject
        })
        setPreviewAudio(audio)
      } else {
        console.log("[Shopping] 기존 오디오 재사용")
        // 기존 오디오 재사용 시 시간 초기화 및 볼륨 설정
        audio.currentTime = 0
        audio.pause()
        audio.volume = ttsVolume
      }

      if (!audio) {
        throw new Error("오디오를 로드할 수 없습니다.")
      }

      // BGM 로드 (있는 경우)
      let sfxAudio: HTMLAudioElement | null = null
      if (bgmUrl) {
        // 새로운 BGM을 만들기 전에 이전 BGM 정리
        if (previewBgmAudio) {
          console.log("[Shopping] 이전 BGM 정리")
          previewBgmAudio.pause()
          previewBgmAudio.currentTime = 0
          previewBgmAudio.src = "" // 오디오 소스 제거
          previewBgmAudio.load() // 오디오 리소스 해제
          setPreviewBgmAudio(null)
        }
        
        console.log("[Shopping] BGM 로드")
        bgmAudio = new Audio(bgmUrl)
        bgmAudio.volume = bgmVolume
        bgmAudio.loop = false // 시간대에 맞게 재생하므로 loop 해제
        
        await new Promise<void>((resolve, reject) => {
          if (!bgmAudio) {
            reject(new Error("BGM 생성 실패"))
            return
          }
          bgmAudio.onloadeddata = () => {
            // BGM의 timeupdate 이벤트로 종료 시간 체크 (추가 보호)
            const currentBgmAudio = bgmAudio // 클로저에서 안전하게 접근하기 위해 로컬 변수에 저장
            if (currentBgmAudio) {
              currentBgmAudio.addEventListener("timeupdate", () => {
                if (previewAudio && currentBgmAudio && !currentBgmAudio.paused) {
                const elapsed = previewAudio.currentTime
                  // 종료 시간에 도달했거나 넘어갔거나 오디오가 끝났으면 즉시 정지 (엄격한 체크)
                  if (elapsed >= bgmEndTime || elapsed < bgmStartTime || elapsed >= previewAudio.duration || previewAudio.ended) {
                    console.log(`[Shopping] BGM timeupdate 이벤트에서 정지: elapsed=${elapsed.toFixed(2)}초, bgmEndTime=${bgmEndTime}초`)
                    currentBgmAudio.pause()
                    currentBgmAudio.currentTime = 0
                  }
                }
              })
              // BGM이 끝났을 때도 체크하여 재생 시간대를 넘었으면 재생하지 않음
              currentBgmAudio.addEventListener("ended", () => {
                if (previewAudio) {
                  const elapsed = previewAudio.currentTime
                  // BGM 자체가 끝났어도 메인 오디오 시간을 체크하여 종료 시간을 넘었으면 재생하지 않음
                  if (elapsed >= bgmEndTime || elapsed < bgmStartTime || elapsed >= previewAudio.duration || previewAudio.ended) {
                    console.log(`[Shopping] BGM ended 이벤트: 재생 시간대 밖이므로 재생하지 않음, elapsed=${elapsed.toFixed(2)}초, bgmEndTime=${bgmEndTime}초`)
                    currentBgmAudio.pause()
                    currentBgmAudio.currentTime = 0
                  } else if (elapsed >= bgmStartTime && elapsed < bgmEndTime && elapsed < previewAudio.duration && !previewAudio.ended) {
                    // 재생 시간대 내에 있으면 다시 재생 (루프)
                    const bgmOffset = elapsed - bgmStartTime
                    const bgmDuration = currentBgmAudio.duration
                    if (isFinite(bgmDuration) && bgmDuration > 0) {
                      const safeCurrentTime = Math.max(0, Math.min(bgmOffset % bgmDuration, bgmDuration))
                      if (isFinite(safeCurrentTime)) {
                        currentBgmAudio.currentTime = safeCurrentTime
                        currentBgmAudio.play().catch(() => {})
                      }
                    }
                  }
              }
            })
              // previewBgmAudio가 설정된 후에도 ended 이벤트를 추가하여 종료 시간 체크
              // 이는 BGM이 자체적으로 끝났을 때도 메인 오디오 시간을 체크하기 위함
              const bgmEndedHandler = () => {
                if (previewAudio && currentBgmAudio) {
                  const elapsed = previewAudio.currentTime
                  // BGM 자체가 끝났어도 메인 오디오 시간을 체크하여 종료 시간을 넘었으면 재생하지 않음
                  if (elapsed >= bgmEndTime || elapsed < bgmStartTime || elapsed >= previewAudio.duration || previewAudio.ended) {
                    console.log(`[Shopping] ⛔ BGM ended 이벤트 (previewBgmAudio): 재생 시간대 밖이므로 재생하지 않음, elapsed=${elapsed.toFixed(2)}초, bgmEndTime=${bgmEndTime}초`)
                    currentBgmAudio.pause()
                    currentBgmAudio.currentTime = 0
                  } else if (elapsed >= bgmStartTime && elapsed < bgmEndTime && elapsed < previewAudio.duration && !previewAudio.ended) {
                    // 재생 시간대 내에 있으면 다시 재생 (루프)
                    const bgmOffset = elapsed - bgmStartTime
                    const bgmDuration = currentBgmAudio.duration
                    if (isFinite(bgmDuration) && bgmDuration > 0) {
                      const safeCurrentTime = Math.max(0, Math.min(bgmOffset % bgmDuration, bgmDuration))
                      if (isFinite(safeCurrentTime)) {
                        currentBgmAudio.currentTime = safeCurrentTime
                        currentBgmAudio.play().catch(() => {})
                      }
                    }
                  }
                }
              }
              currentBgmAudio.addEventListener("ended", bgmEndedHandler)
              setPreviewBgmAudio(currentBgmAudio)
            }
            resolve()
          }
          bgmAudio.onerror = (e) => {
            console.warn("[Shopping] BGM 로드 실패, 계속 진행:", e)
            bgmAudio = null // BGM 로드 실패 시 null로 설정
            setPreviewBgmAudio(null)
            resolve() // BGM이 없어도 계속 진행
          }
        })
      } else {
        // BGM이 없으면 기존 BGM 정리
        if (previewBgmAudio) {
          previewBgmAudio.pause()
          previewBgmAudio.currentTime = 0
          previewBgmAudio.src = "" // 오디오 소스 제거
          previewBgmAudio.load() // 오디오 리소스 해제
          setPreviewBgmAudio(null)
        }
      }

      // 효과음 로드 (있는 경우)
      if (sfxUrl) {
        console.log("[Shopping] 효과음 로드")
        sfxAudio = new Audio(sfxUrl)
        sfxAudio.volume = sfxVolume
        sfxAudio.loop = false
        
        await new Promise<void>((resolve, reject) => {
          if (!sfxAudio) {
            reject(new Error("효과음 생성 실패"))
            return
          }
          sfxAudio.onloadeddata = () => {
            setPreviewSfxAudio(sfxAudio)
            resolve()
          }
          sfxAudio.onerror = (e) => {
            console.warn("[Shopping] 효과음 로드 실패, 계속 진행:", e)
            sfxAudio = null
            setPreviewSfxAudio(null)
            resolve()
          }
        })
      } else {
        // 효과음이 없으면 기존 효과음 정리
        if (previewSfxAudio) {
          previewSfxAudio.pause()
          previewSfxAudio.currentTime = 0
          setPreviewSfxAudio(null)
        }
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
          // 모바일에서 더 나은 버퍼링을 위해 preload 설정
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                          (typeof window !== "undefined" && window.innerWidth <= 768)
          // 모바일에서도 auto로 설정하여 충분한 버퍼링 보장
          video.preload = "auto"
          
          await new Promise<void>((resolve, reject) => {
            // loadedmetadata와 canplay 이벤트 사용
            let metadataLoaded = false
            let canPlay = false
            let canPlayThrough = false
            
            const checkReady = () => {
              // 모바일에서는 canplaythrough까지 기다림
              if (isMobile) {
                if (metadataLoaded && canPlay && canPlayThrough) {
                  video.currentTime = 0 // 시작 위치로 초기화
                  console.log(`[Shopping] 비디오 ${i + 1} 로드 완료 (모바일): duration=${video.duration.toFixed(2)}초, readyState=${video.readyState}`)
                  resolve()
                }
              } else {
              if (metadataLoaded && canPlay) {
                video.currentTime = 0 // 시작 위치로 초기화
                console.log(`[Shopping] 비디오 ${i + 1} 로드 완료: duration=${video.duration.toFixed(2)}초`)
                resolve()
                }
              }
            }
            
            video.onloadedmetadata = () => {
              metadataLoaded = true
              console.log(`[Shopping] 비디오 ${i + 1} 메타데이터 로드 완료`)
              checkReady()
            }
            
            video.oncanplay = () => {
              canPlay = true
              console.log(`[Shopping] 비디오 ${i + 1} canplay 이벤트`)
              checkReady()
            }
            
            // 모바일에서 버퍼링 개선을 위한 이벤트 추가
            if (isMobile) {
              video.oncanplaythrough = () => {
                canPlayThrough = true
                console.log(`[Shopping] 비디오 ${i + 1} canplaythrough 이벤트 (모바일)`)
                checkReady()
              }
            }
            
            video.onerror = (e) => {
              console.error(`[Shopping] 비디오 ${i + 1} 로드 에러:`, e)
              reject(new Error(`비디오 ${i + 1} 로드 실패`))
            }
            
            video.load()
            
            // 타임아웃 설정 (모바일에서는 더 길게)
            const timeout = isMobile ? 30000 : 15000
            setTimeout(() => {
              if (isMobile && (!metadataLoaded || !canPlay || !canPlayThrough)) {
                console.warn(`[Shopping] 비디오 ${i + 1} 로드 타임아웃 (모바일), 계속 진행 (readyState: ${video.readyState})`)
                if (video.readyState >= 2) {
                  // canplay 이상이면 계속 진행
                  metadataLoaded = true
                  canPlay = true
                  canPlayThrough = true
                  checkReady()
                } else {
                  resolve() // 타임아웃이어도 계속 진행
                }
              } else if (!isMobile && (!metadataLoaded || !canPlay)) {
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
            }, timeout)
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

      // 썸네일 이미지 로드 (선택된 썸네일 사용)
      let thumbnailImage: HTMLImageElement | null = null
      if (selectedThumbnailIndex >= 0 && thumbnailImages[selectedThumbnailIndex]) {
        try {
          const selectedThumbnail = thumbnailImages[selectedThumbnailIndex]
          thumbnailImage = new Image()
          thumbnailImage.crossOrigin = "anonymous"
          thumbnailImage.src = selectedThumbnail.url
          await new Promise<void>((resolve, reject) => {
            thumbnailImage!.onload = () => resolve()
            thumbnailImage!.onerror = reject
            // 타임아웃 설정
            setTimeout(() => {
              if (!thumbnailImage!.complete) {
                reject(new Error("썸네일 로드 타임아웃"))
              }
            }, 5000)
          })
          console.log("[Shopping] 선택된 썸네일 이미지 로드 완료 (인덱스:", selectedThumbnailIndex, ")")
        } catch (error) {
          console.warn("[Shopping] 썸네일 이미지 로드 실패, 계속 진행:", error)
        }
      } else if (thumbnailUrl) {
        // 선택된 썸네일이 없으면 기존 thumbnailUrl 사용 (하위 호환성)
        try {
          thumbnailImage = new Image()
          thumbnailImage.crossOrigin = "anonymous"
          thumbnailImage.src = thumbnailUrl
          await new Promise<void>((resolve, reject) => {
            thumbnailImage!.onload = () => resolve()
            thumbnailImage!.onerror = reject
            setTimeout(() => {
              if (!thumbnailImage!.complete) {
                reject(new Error("썸네일 로드 타임아웃"))
              }
            }, 5000)
          })
          console.log("[Shopping] 썸네일 이미지 로드 완료 (기존 URL)")
        } catch (error) {
          console.warn("[Shopping] 썸네일 이미지 로드 실패, 계속 진행:", error)
        }
      }

      // 미리보기 렌더링 함수 (썸네일 포함, BGM 및 효과음 적용)
      let lastVideoIndex = -1
      const currentBgmAudio = bgmAudio // 클로저에서 접근 가능하도록
      const currentSfxAudio = sfxAudio // 클로저에서 접근 가능하도록
      const THUMBNAIL_DURATION = 0.0001
      
      const renderPreview = () => {
        const elapsed = audio.paused ? currentTime : audio.currentTime
        if (!audio.paused) {
          setCurrentTime(elapsed)
          
          // BGM 시간대 체크 및 재생/정지
          if (currentBgmAudio && bgmUrl) {
            // bgmEndTime에 도달했거나 넘어갔거나 bgmStartTime 이전이면 무조건 정지 (엄격한 체크)
            // bgmEndTime에 도달하면 즉시 정지 (예: 10초에 도달하면 정지)
            if (previewAudio && (elapsed >= bgmEndTime || elapsed < bgmStartTime || elapsed >= previewAudio.duration || previewAudio.ended)) {
              if (!currentBgmAudio.paused) {
                currentBgmAudio.pause()
                currentBgmAudio.currentTime = 0
              }
            } else if (previewAudio && elapsed >= bgmStartTime && elapsed < bgmEndTime && elapsed < previewAudio.duration && !previewAudio.ended) {
              // BGM 재생 시간대 내에 있을 때만 재생 (elapsed < bgmEndTime - 종료 시간에 도달하면 재생하지 않음)
              if (currentBgmAudio.paused) {
                // BGM 시작 시간에 맞춰 오디오 위치 설정
                const bgmOffset = elapsed - bgmStartTime
                const bgmDuration = currentBgmAudio.duration
                if (isFinite(bgmDuration) && bgmDuration > 0) {
                  const safeCurrentTime = Math.max(0, Math.min(bgmOffset % bgmDuration, bgmDuration))
                  if (isFinite(safeCurrentTime)) {
                    currentBgmAudio.currentTime = safeCurrentTime
                    currentBgmAudio.play().catch(() => {})
                  }
                }
              } else {
                // BGM이 재생 중이면 종료 시간에 도달했는지 계속 확인
                if (elapsed >= bgmEndTime || elapsed >= previewAudio.duration || previewAudio.ended) {
                  // 종료 시간에 도달했거나 넘어갔거나 오디오가 끝났으면 즉시 정지
                  currentBgmAudio.pause()
                  currentBgmAudio.currentTime = 0
                }
              }
            } else {
              // BGM 재생 시간대 밖이면 무조건 정지
              if (!currentBgmAudio.paused) {
                currentBgmAudio.pause()
                currentBgmAudio.currentTime = 0
              }
            }
          }
          
          // 효과음 시간대 체크 및 재생/정지
          if (currentSfxAudio && sfxUrl) {
            if (elapsed >= sfxStartTime && elapsed < sfxEndTime) {
              if (currentSfxAudio.paused) {
                // 효과음 시작 시간에 맞춰 오디오 위치 설정
                const sfxOffset = elapsed - sfxStartTime
                currentSfxAudio.currentTime = Math.min(sfxOffset, currentSfxAudio.duration)
                currentSfxAudio.play().catch(() => {})
              }
            } else {
              if (!currentSfxAudio.paused) {
                currentSfxAudio.pause()
                currentSfxAudio.currentTime = 0
              }
            }
          }
        }

        // 캔버스 초기화
        ctx.fillStyle = "black"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // 썸네일이 있고 0.0001초 이하일 때 썸네일 표시
        const adjustedElapsed = Math.max(0, elapsed - THUMBNAIL_DURATION)
        
        if (thumbnailImage && elapsed < THUMBNAIL_DURATION) {
          ctx.drawImage(thumbnailImage, 0, 0, canvas.width, canvas.height)
        } else {
          // 썸네일 시간이 지나면 기존 영상 표시
          // 현재 시간에 맞는 영상 찾기 (썸네일 시간 제외)
        let currentVideoIndex = -1
        for (let i = 0; i < videoStartTimes.length; i++) {
          const startTime = videoStartTimes[i]
          const endTime = i < videoStartTimes.length - 1 ? videoStartTimes[i + 1] : startTime + videoDurations[i]
          
            if (adjustedElapsed >= startTime && adjustedElapsed < endTime) {
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
              const videoElapsed = adjustedElapsed - videoStartTime
            
            if (video && !isNaN(video.duration) && video.duration > 0) {
              // 모바일에서 비디오가 완전히 로드되었는지 확인
              const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                              (typeof window !== "undefined" && window.innerWidth <= 768)
              
              // 모바일에서는 readyState가 충분히 높아야 재생 가능
              if (isMobile && video.readyState < 2) {
                // 비디오가 아직 로드되지 않았으면 로드 대기
                video.load()
                video.addEventListener("canplay", () => {
                  video.currentTime = Math.max(0, Math.min(videoElapsed, video.duration))
                  video.play().catch((error) => {
                    console.warn(`[Shopping] 모바일 비디오 재생 실패, 재시도:`, error)
                    // 재시도
                    setTimeout(() => {
                      video.play().catch(() => {})
                    }, 100)
                  })
                }, { once: true })
              } else {
              // 시작 시간 설정
              video.currentTime = Math.max(0, Math.min(videoElapsed, video.duration))
              // 비디오 재생 (자체적으로 재생되도록)
                video.play().catch((error) => {
                  console.warn(`[Shopping] 비디오 재생 실패:`, error)
                  // 모바일에서 재생 실패 시 재시도
                  if (isMobile) {
                    setTimeout(() => {
              video.play().catch(() => {})
                    }, 100)
                  }
                })
              }
            }
          }
          
          lastVideoIndex = currentVideoIndex
        }

          // 현재 영상을 캔버스에 그리기 (비율 유지)
          if (currentVideoIndex >= 0 && videoElements[currentVideoIndex]) {
            const currentVideo = videoElements[currentVideoIndex]
            
            try {
              if (currentVideo.readyState >= 2 || (currentVideo.videoWidth > 0 && currentVideo.videoHeight > 0)) {
                const videoWidth = currentVideo.videoWidth
                const videoHeight = currentVideo.videoHeight
                const canvasWidth = canvas.width
                const canvasHeight = canvas.height
                
                // 비디오와 캔버스의 비율 계산
                const videoAspect = videoWidth / videoHeight
                const canvasAspect = canvasWidth / canvasHeight
                
                let drawWidth = canvasWidth
                let drawHeight = canvasHeight
                let drawX = 0
                let drawY = 0
                
                // 비율에 맞춰 중앙 크롭 (cover 방식)
                if (videoAspect > canvasAspect) {
                  // 비디오가 더 넓음 - 높이에 맞추고 좌우 크롭
                  drawHeight = canvasHeight
                  drawWidth = drawHeight * videoAspect
                  drawX = (canvasWidth - drawWidth) / 2
                } else {
                  // 비디오가 더 높음 - 너비에 맞추고 상하 크롭
                  drawWidth = canvasWidth
                  drawHeight = drawWidth / videoAspect
                  drawY = (canvasHeight - drawHeight) / 2
                }
                
                ctx.drawImage(currentVideo, 0, 0, videoWidth, videoHeight, drawX, drawY, drawWidth, drawHeight)
              }
            } catch (e) {
              // 그리기 실패 시 무시
            }
          }
        }

        // 자막 그리기 (썸네일 시간 동안에는 표시하지 않음)
        if (scriptLines.length > 0 && (!thumbnailImage || elapsed >= THUMBNAIL_DURATION)) {
          const elapsedMs = adjustedElapsed * 1000
          const currentLine = scriptLines.find(
            line => elapsedMs >= line.startTime && elapsedMs < line.endTime
          )
          
          if (currentLine) {
            // 의미 단위(쉼표·마침표 기준)로 나눠 한 줄씩 순서대로 표시
            const phrases = getSubtitlePhrases(currentLine.text)
            const lineDuration = currentLine.endTime - currentLine.startTime
            const timeInLine = elapsedMs - currentLine.startTime
            const phraseIndex = phrases.length <= 1 ? 0 : Math.min(Math.floor((timeInLine / lineDuration) * phrases.length), phrases.length - 1)
            const textToShow = phrases[phraseIndex] || currentLine.text
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

        if (!audio.ended && !audio.paused) {
          const frameId = requestAnimationFrame(renderPreview)
          setPreviewAnimationFrame(frameId)
        } else {
          setIsPlaying(false)
          // 모든 비디오 일시정지
          for (const video of videoElements) {
            video.pause()
          }
          // BGM 일시정지 및 정지
          if (currentBgmAudio) {
            currentBgmAudio.pause()
            currentBgmAudio.currentTime = 0 // BGM 시간 초기화
          }
          // 효과음 일시정지 및 정지
          if (currentSfxAudio) {
            currentSfxAudio.pause()
            currentSfxAudio.currentTime = 0
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
      const THUMBNAIL_DURATION_INIT = 0.0001
      
      // 캔버스 초기화
      ctx.fillStyle = "black"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // 썸네일이 있으면 먼저 표시, 없으면 첫 번째 영상 표시
      if (thumbnailImage && initialElapsed < THUMBNAIL_DURATION_INIT) {
        ctx.drawImage(thumbnailImage, 0, 0, canvas.width, canvas.height)
      } else if (videoElements[0]) {
        const video = videoElements[0]
        video.currentTime = 0
        try {
          if (video.readyState >= 1 || (video.videoWidth > 0 && video.videoHeight > 0)) {
            const videoWidth = video.videoWidth
            const videoHeight = video.videoHeight
            const canvasWidth = canvas.width
            const canvasHeight = canvas.height
            
            // 비디오와 캔버스의 비율 계산
            const videoAspect = videoWidth / videoHeight
            const canvasAspect = canvasWidth / canvasHeight
            
            let drawWidth = canvasWidth
            let drawHeight = canvasHeight
            let drawX = 0
            let drawY = 0
            
            // 비율에 맞춰 중앙 크롭 (cover 방식)
            if (videoAspect > canvasAspect) {
              // 비디오가 더 넓음 - 높이에 맞추고 좌우 크롭
              drawHeight = canvasHeight
              drawWidth = drawHeight * videoAspect
              drawX = (canvasWidth - drawWidth) / 2
            } else {
              // 비디오가 더 높음 - 너비에 맞추고 상하 크롭
              drawWidth = canvasWidth
              drawHeight = drawWidth / videoAspect
              drawY = (canvasHeight - drawHeight) / 2
            }
            
            ctx.drawImage(video, 0, 0, videoWidth, videoHeight, drawX, drawY, drawWidth, drawHeight)
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

  // 미리보기 생성 (롱폼 방식: HTML video 엘리먼트 사용)
  // [모바일에서 끊기는 이유]
  // 1) 메모리: 영상 3개+오디오+썸네일을 한꺼번에 로드하면 메모리 부족으로 탭이 죽거나 끊길 수 있음.
  // 2) iOS: canplaythrough가 재생 전에는 잘 안 뜨므로, 모바일에서는 canplay만 사용하고 타임아웃을 넉넉히 둠.
  // 3) 다운로드(MediaRecorder): Safari/iOS는 video/webm;vp9를 지원하지 않아 녹화가 실패할 수 있음 → 지원 코덱으로 폴백 처리.
  const handleGeneratePreview = async () => {
    // 3개의 개별 영상이 모두 준비되어야 함
    if (convertedVideoUrls.size !== 3 || !ttsAudioUrl) {
      alert("3개의 영상과 TTS가 모두 준비되어야 합니다.")
      return
    }

    setIsGeneratingPreview(true)
    setError("")
    
    try {
      console.log("[Shopping] 미리보기 생성 시작 (롱폼 방식)")

      // 오디오 로드 (blob URL인지 확인)
      let audioUrl: string
      if (ttsAudioUrl.startsWith("blob:")) {
        // blob URL이면 직접 사용
        audioUrl = ttsAudioUrl
      } else {
        // 일반 URL이면 fetch로 가져오기
        const audioResponse = await fetch(ttsAudioUrl)
        const audioBlob = await audioResponse.blob()
        audioUrl = URL.createObjectURL(audioBlob)
      }
      
      const audio = new Audio(audioUrl)
      audio.volume = ttsVolume // TTS 볼륨 설정

      await new Promise<void>((resolve, reject) => {
        audio.onloadeddata = () => resolve()
        audio.onerror = reject
      })

      const actualAudioDuration = audio.duration
      console.log("[Shopping] 실제 오디오 길이:", actualAudioDuration.toFixed(3), "초")

      // BGM 로드 (있는 경우)
      let bgmAudio: HTMLAudioElement | null = null
      let sfxAudio: HTMLAudioElement | null = null
      if (bgmUrl) {
        // 새로운 BGM을 만들기 전에 이전 BGM 정리
        if (previewBgmAudio) {
          console.log("[Shopping] 이전 BGM 정리")
          previewBgmAudio.pause()
          previewBgmAudio.currentTime = 0
          previewBgmAudio.src = "" // 오디오 소스 제거
          previewBgmAudio.load() // 오디오 리소스 해제
          setPreviewBgmAudio(null)
        }
        
        console.log("[Shopping] BGM 로드")
        bgmAudio = new Audio(bgmUrl)
        bgmAudio.volume = bgmVolume
        bgmAudio.loop = false // 시간대에 맞게 재생하므로 loop 해제
        
        await new Promise<void>((resolve, reject) => {
          if (!bgmAudio) {
            reject(new Error("BGM 생성 실패"))
            return
          }
          bgmAudio.onloadeddata = () => {
            setPreviewBgmAudio(bgmAudio)
            resolve()
          }
          bgmAudio.onerror = (e) => {
            console.warn("[Shopping] BGM 로드 실패, 계속 진행:", e)
            bgmAudio = null
            setPreviewBgmAudio(null)
            resolve() // BGM이 없어도 계속 진행
          }
        })
      } else {
        // BGM이 없으면 기존 BGM 정리
        if (previewBgmAudio) {
          previewBgmAudio.pause()
          previewBgmAudio.currentTime = 0
          previewBgmAudio.src = "" // 오디오 소스 제거
          previewBgmAudio.load() // 오디오 리소스 해제
          setPreviewBgmAudio(null)
        }
      }

      // 효과음 로드 (있는 경우)
      if (sfxUrl) {
        console.log("[Shopping] 효과음 로드")
        sfxAudio = new Audio(sfxUrl)
        sfxAudio.volume = sfxVolume
        sfxAudio.loop = false
        
        await new Promise<void>((resolve, reject) => {
          if (!sfxAudio) {
            reject(new Error("효과음 생성 실패"))
            return
          }
          sfxAudio.onloadeddata = () => {
            setPreviewSfxAudio(sfxAudio)
            resolve()
          }
          sfxAudio.onerror = (e) => {
            console.warn("[Shopping] 효과음 로드 실패, 계속 진행:", e)
            sfxAudio = null
            setPreviewSfxAudio(null)
            resolve()
          }
        })
      } else {
        // 효과음이 없으면 기존 효과음 정리
        if (previewSfxAudio) {
          previewSfxAudio.pause()
          previewSfxAudio.currentTime = 0
          setPreviewSfxAudio(null)
        }
      }

      // 3개의 개별 영상 로드 (롱폼 방식: HTML video 엘리먼트로 직접 사용)
      const videoElements: HTMLVideoElement[] = []
      const videoDurations: number[] = []
      
      // TTS 길이를 3으로 나눈 값 계산
      const durationPerVideo = Math.round(actualAudioDuration / 3)
      
      for (let i = 0; i < 3; i++) {
        const videoUrl = convertedVideoUrls.get(i)
        if (!videoUrl) {
          throw new Error(`영상 ${i + 1}이 준비되지 않았습니다.`)
        }
        
        const video = document.createElement("video")
        // blob: URL은 same-origin이라 crossOrigin 불필요; 외부 URL만 anonymous (CORS)
        if (!videoUrl.startsWith("blob:")) {
        video.crossOrigin = "anonymous"
        }
        video.src = videoUrl
        video.muted = true
        video.playsInline = true
        // 모바일에서 더 나은 버퍼링을 위해 preload 설정
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                        (typeof window !== "undefined" && window.innerWidth <= 768)
        // 모바일: canplay만 기다림 (iOS는 canplaythrough가 재생 전에 안 뜨어서 끊김·타임아웃 원인)
        video.preload = "auto"
        video.loop = false // 순차 재생이므로 루프 없음
        
        await new Promise<void>((resolve, reject) => {
          let metadataLoaded = false
          let canPlay = false
          let resolved = false
          const done = () => { if (!resolved) { resolved = true; resolve() } }
          const fail = (err: Error) => { if (!resolved) { resolved = true; reject(err) } }
          
          const checkReady = () => {
            // 모바일: canplay만 만족하면 진행 (canplaythrough 대기 시 iOS에서 타임아웃만 나고 끊김)
            if (isMobile) {
              if (metadataLoaded && canPlay) {
                const duration = video.duration || durationPerVideo
                videoDurations.push(duration)
                console.log(`[Shopping] 미리보기 영상 ${i + 1} 로드 완료 (모바일), 길이: ${duration.toFixed(2)}초, readyState=${video.readyState}`)
                done()
              }
            } else {
              if (metadataLoaded && canPlay) {
            const duration = video.duration || durationPerVideo
            videoDurations.push(duration)
            console.log(`[Shopping] 미리보기 영상 ${i + 1} 로드 완료, 길이: ${duration.toFixed(2)}초`)
                done()
              }
            }
          }
          
          video.onloadedmetadata = () => {
            metadataLoaded = true
            console.log(`[Shopping] 미리보기 영상 ${i + 1} 메타데이터 로드 완료`)
            checkReady()
          }
          
          video.oncanplay = () => {
            canPlay = true
            console.log(`[Shopping] 미리보기 영상 ${i + 1} canplay 이벤트`)
            checkReady()
          }
          
          if (!isMobile) {
            video.oncanplaythrough = () => {
              canPlay = true
              checkReady()
            }
          }
          
          video.onerror = () => {
            const code = video.error?.code ?? -1
            const msg = video.error?.message ?? "알 수 없음"
            console.error(`[Shopping] 미리보기 영상 ${i + 1} 로드 실패: code=${code}, message=${msg}`)
            fail(new Error(`영상 ${i + 1} 로드 실패 (code: ${code}). 브라우저가 해당 형식을 지원하지 않거나 파일이 손상되었을 수 있습니다.`))
          }
          video.load()
          
          const timeout = isMobile ? 45000 : 10000
          setTimeout(() => {
            if (resolved) return
            if (metadataLoaded && canPlay) return
            if (isMobile) {
              console.warn(`미리보기 비디오 ${i + 1} 로드 타임아웃 (모바일), 계속 진행 (readyState: ${video.readyState})`)
              if (video.readyState >= 2) {
                canPlay = true
                checkReady()
              } else {
              videoDurations.push(durationPerVideo)
                done()
              }
            } else {
              console.warn(`미리보기 비디오 ${i + 1} 로드 타임아웃, 계속 진행`)
              if (video.readyState >= 1) {
                metadataLoaded = true
                canPlay = true
                checkReady()
              } else {
                videoDurations.push(durationPerVideo)
                done()
              }
            }
          }, timeout)
        })
        
        videoElements.push(video)
      }
      
      console.log("[Shopping] 미리보기 3개 영상 로드 완료, 각 영상 길이:", videoDurations.map(d => d.toFixed(2) + "초"))
      
      // 썸네일 이미지 로드 (선택된 썸네일 사용) - 미리 로드하여 상태로 저장
      let thumbnailImage: HTMLImageElement | null = null
      if (selectedThumbnailIndex >= 0 && thumbnailImages[selectedThumbnailIndex]) {
        try {
          const selectedThumbnail = thumbnailImages[selectedThumbnailIndex]
          thumbnailImage = new Image()
          thumbnailImage.crossOrigin = "anonymous"
          await new Promise<void>((resolve, reject) => {
            thumbnailImage!.onload = () => resolve()
            thumbnailImage!.onerror = reject
            thumbnailImage!.src = selectedThumbnail.url
          })
          console.log("[Shopping] 선택된 썸네일 이미지 로드 완료 (인덱스:", selectedThumbnailIndex, ")")
          setPreviewThumbnailImage(thumbnailImage)
        } catch (error) {
          console.warn("[Shopping] 썸네일 이미지 로드 실패, 계속 진행:", error)
          setPreviewThumbnailImage(null)
        }
      } else if (thumbnailUrl) {
        // 선택된 썸네일이 없으면 기존 thumbnailUrl 사용 (하위 호환성)
        try {
          thumbnailImage = new Image()
          thumbnailImage.crossOrigin = "anonymous"
          await new Promise<void>((resolve, reject) => {
            thumbnailImage!.onload = () => resolve()
            thumbnailImage!.onerror = reject
            thumbnailImage!.src = thumbnailUrl
          })
          console.log("[Shopping] 썸네일 이미지 로드 완료 (기존 URL)")
          setPreviewThumbnailImage(thumbnailImage)
        } catch (error) {
          console.warn("[Shopping] 썸네일 이미지 로드 실패, 계속 진행:", error)
          setPreviewThumbnailImage(null)
        }
      } else {
        setPreviewThumbnailImage(null)
      }

      // 오디오 종료 시 BGM도 멈추기
      audio.addEventListener("ended", () => {
        console.log("[Shopping] 오디오 재생 완료, BGM도 멈춤")
        setIsPlaying(false)
        // 비디오 일시정지
        if (previewVideoRef.current) {
          previewVideoRef.current.pause()
        }
        // BGM 강제 정지 (previewBgmAudio만 사용)
        if (previewBgmAudio) {
          previewBgmAudio.pause()
          previewBgmAudio.currentTime = 0
          // 오디오 소스 제거하여 완전히 정지
          try {
            previewBgmAudio.src = ""
            previewBgmAudio.load()
          } catch (e) {
            console.warn("[Shopping] BGM 정리 중 오류:", e)
          }
        }
        // 효과음 강제 정지
        if (previewSfxAudio) {
          previewSfxAudio.pause()
          previewSfxAudio.currentTime = 0
          try {
            previewSfxAudio.src = ""
            previewSfxAudio.load()
          } catch (e) {
            console.warn("[Shopping] 효과음 정리 중 오류:", e)
          }
        }
      })

      // 롱폼 방식: onTimeUpdate 이벤트로 자막 동기화
      audio.addEventListener("timeupdate", () => {
        const elapsed = audio.currentTime
        setCurrentTime(elapsed)

        // 오디오가 끝났으면 BGM과 효과음 모두 정지
        if (audio.ended || elapsed >= audio.duration) {
          if (previewBgmAudio && !previewBgmAudio.paused) {
            previewBgmAudio.pause()
            const bgmDuration = previewBgmAudio.duration
            if (isFinite(bgmDuration)) {
              previewBgmAudio.currentTime = 0
            }
          }
          if (previewSfxAudio && !previewSfxAudio.paused) {
            previewSfxAudio.pause()
            const sfxDuration = previewSfxAudio.duration
            if (isFinite(sfxDuration)) {
              previewSfxAudio.currentTime = 0
            }
          }
          return
        }

        // BGM 시간대 체크 및 재생/정지 (previewBgmAudio만 사용)
        if (previewBgmAudio && bgmUrl) {
          // duration이 유효한지 확인 (NaN, Infinity 체크)
          const bgmDuration = previewBgmAudio.duration
          if (isFinite(bgmDuration) && bgmDuration > 0) {
            // 먼저 종료 시간에 도달했거나 넘어갔는지 체크 (가장 우선순위) - 엄격한 체크
            // bgmEndTime에 도달하면 즉시 정지 (예: 10초에 도달하면 정지)
            // 이 체크를 먼저 수행하여 BGM이 재생 중이든 아니든 무조건 정지
            // CRITICAL: 이 체크는 매 timeupdate마다 반드시 실행되어야 함
            if (elapsed >= bgmEndTime || elapsed < bgmStartTime || elapsed >= audio.duration || audio.ended) {
              // BGM이 재생 중이면 즉시 정지 (강제 정지) - 무조건 정지
              if (!previewBgmAudio.paused) {
                console.log(`[Shopping] ⛔ BGM 강제 정지: elapsed=${elapsed.toFixed(2)}초, bgmEndTime=${bgmEndTime}초, bgmStartTime=${bgmStartTime}초`)
                previewBgmAudio.pause()
                previewBgmAudio.currentTime = 0
              }
              // 재생 시간대 밖이므로 더 이상 진행하지 않음 (return으로 빠져나감)
              return // 이 시점에서 더 이상 BGM 로직을 실행하지 않음
            }
            
            // BGM 재생 시간대 내에 있을 때만 재생
            if (elapsed >= bgmStartTime && elapsed < bgmEndTime && elapsed < audio.duration && !audio.ended) {
              // BGM 재생 시간대 내에 있고 오디오가 아직 끝나지 않았을 때만 재생
              // 주의: elapsed < bgmEndTime (등호 없음) - 종료 시간에 도달하면 재생하지 않음
              const bgmOffset = elapsed - bgmStartTime
              const safeCurrentTime = Math.max(0, Math.min(bgmOffset % bgmDuration, bgmDuration))
              
              if (previewBgmAudio.paused) {
                // BGM이 일시정지 상태면 재생 시작
                if (isFinite(safeCurrentTime)) {
                  previewBgmAudio.currentTime = safeCurrentTime
                  previewBgmAudio.play().catch(() => {})
                }
              } else {
                // BGM이 재생 중이면 종료 시간을 넘어가지 않았는지 매번 확인 (매우 중요!)
                // 매 timeupdate마다 체크하여 종료 시간에 도달하면 즉시 정지
                // 가장 먼저 종료 시간 체크 (우선순위 최상위) - 재생 중일 때도 반드시 체크
                if (elapsed >= bgmEndTime || elapsed >= audio.duration || audio.ended) {
                  // 종료 시간에 도달했거나 넘어갔거나 오디오가 끝났으면 즉시 정지
                  console.log(`[Shopping] BGM 재생 중 종료 시간 도달: elapsed=${elapsed.toFixed(2)}초, bgmEndTime=${bgmEndTime}초, paused=${previewBgmAudio.paused}`)
                  previewBgmAudio.pause()
                  previewBgmAudio.currentTime = 0
                  // 정지 후 더 이상 진행하지 않음 (return으로 빠져나감)
                  return
                }
                
                // 종료 시간 내에 있을 때만 시간 동기화
                if (elapsed < bgmEndTime) {
                  // 종료 시간 내에 있으면 시간 동기화 (0.1초 이상 차이나면)
                  if (Math.abs(previewBgmAudio.currentTime - safeCurrentTime) > 0.1) {
                    previewBgmAudio.currentTime = safeCurrentTime
                  }
                }
              }
            } else {
              // BGM 재생 시간대 밖이면 무조건 정지
              if (!previewBgmAudio.paused) {
                console.log(`[Shopping] BGM 재생 시간대 밖: elapsed=${elapsed.toFixed(2)}초, bgmStartTime=${bgmStartTime}초, bgmEndTime=${bgmEndTime}초`)
                previewBgmAudio.pause()
                previewBgmAudio.currentTime = 0
              }
            }
          }
        }

        // 효과음 시간대 체크 및 재생/정지 (previewSfxAudio만 사용)
        if (previewSfxAudio && sfxUrl) {
          // duration이 유효한지 확인 (NaN, Infinity 체크)
          const sfxDuration = previewSfxAudio.duration
          if (isFinite(sfxDuration) && sfxDuration > 0) {
            // sfxEndTime을 넘어갔거나 sfxStartTime 이전이거나 오디오가 끝났으면 무조건 효과음 정지
            if (elapsed >= sfxEndTime || elapsed < sfxStartTime || elapsed >= audio.duration) {
              if (!previewSfxAudio.paused) {
                previewSfxAudio.pause()
                previewSfxAudio.currentTime = 0
              }
            } else if (elapsed >= sfxStartTime && elapsed < sfxEndTime && elapsed < audio.duration) {
              // 효과음 재생 시간대 내에 있고 오디오가 아직 끝나지 않았을 때만 재생
              const sfxOffset = elapsed - sfxStartTime
              const safeCurrentTime = Math.max(0, Math.min(sfxOffset, sfxDuration))
              
              if (previewSfxAudio.paused) {
                // 효과음이 일시정지 상태면 재생 시작
                if (isFinite(safeCurrentTime)) {
                  previewSfxAudio.currentTime = safeCurrentTime
                  previewSfxAudio.play().catch(() => {})
                }
              } else {
                // 효과음이 재생 중이면 시간 동기화 (0.1초 이상 차이나면)
                if (Math.abs(previewSfxAudio.currentTime - safeCurrentTime) > 0.1) {
                  previewSfxAudio.currentTime = safeCurrentTime
                }
              }
            }
          }
        }

        // 오디오가 끝났는지 확인
        if (audio.ended || elapsed >= audio.duration) {
          setIsPlaying(false)
          // 비디오 일시정지
          if (previewVideoRef.current) {
            previewVideoRef.current.pause()
          }
          // BGM 일시정지 및 정지 (previewBgmAudio만 사용)
          if (previewBgmAudio) {
            previewBgmAudio.pause()
            const bgmDuration = previewBgmAudio.duration
            if (isFinite(bgmDuration)) {
              previewBgmAudio.currentTime = 0
            }
          }
          // 효과음 일시정지 및 정지 (previewSfxAudio만 사용)
          if (previewSfxAudio) {
            previewSfxAudio.pause()
            const sfxDuration = previewSfxAudio.duration
            if (isFinite(sfxDuration)) {
              previewSfxAudio.currentTime = 0
            }
          }
          return
        }

        // 썸네일 시간 체크
        const THUMBNAIL_DURATION = 0.01 // 0.01초
        const elapsedMs = elapsed * 1000
        
        // 각 영상의 시작 시간 계산
        const videoStartTimes = [THUMBNAIL_DURATION]
        for (let i = 0; i < 3; i++) {
          const startTime = i === 0 
            ? THUMBNAIL_DURATION 
            : videoStartTimes[i] + videoDurations[i - 1]
          videoStartTimes.push(startTime)
        }
        
        // 현재 시간에 맞는 영상 찾기 및 동기화
        let foundVideoIndex = -1
        let videoTime = 0
        
        if (elapsed >= THUMBNAIL_DURATION) {
          for (let i = 0; i < 3; i++) {
            const startTime = videoStartTimes[i + 1]
            const endTime = startTime + videoDurations[i]
            
            if (elapsed >= startTime && elapsed < endTime) {
              foundVideoIndex = i
              videoTime = elapsed - startTime
              break
            }
          }
        }
        
        // 현재 영상 인덱스 업데이트
        if (foundVideoIndex !== currentVideoIndex) {
          setCurrentVideoIndex(foundVideoIndex)
        }
        
        // 현재 영상 동기화
        if (foundVideoIndex >= 0 && videoElements[foundVideoIndex]) {
          const video = videoElements[foundVideoIndex]
          
          // video ref에 현재 영상 설정
          if (previewVideoRef.current) {
            // 영상 전환 감지
            if (previewVideoRef.current.src !== video.src) {
              // 영상 변경 (전환 효과 최소화)
              const wasPlaying = !previewVideoRef.current.paused
              
              previewVideoRef.current.src = video.src
              previewVideoRef.current.crossOrigin = video.crossOrigin
              previewVideoRef.current.muted = video.muted
              previewVideoRef.current.playsInline = video.playsInline
              previewVideoRef.current.loop = false
              
              // 영상이 준비되면 즉시 재생
              const onLoadedData = () => {
                if (previewVideoRef.current && previewVideoRef.current.src === video.src) {
                  previewVideoRef.current.currentTime = videoTime
                  if (wasPlaying && !audio.paused) {
                    previewVideoRef.current.play().catch(() => {})
                  }
                  setVideoTransitionOpacity(1)
                  previewVideoRef.current.removeEventListener('loadeddata', onLoadedData)
                }
              }
              
              previewVideoRef.current.addEventListener('loadeddata', onLoadedData)
              previewVideoRef.current.load()
              
              // 빠른 페이드 효과 (거의 즉시)
              setVideoTransitionOpacity(0.3)
              setTimeout(() => setVideoTransitionOpacity(1), 30)
            } else {
              // 같은 영상이면 시간 동기화만 수행 (더 정확하게)
              if (Math.abs(previewVideoRef.current.currentTime - videoTime) > 0.05) {
                previewVideoRef.current.currentTime = videoTime
              }
              
              // 재생 보장
              if (previewVideoRef.current.paused && !audio.paused) {
                previewVideoRef.current.play().catch(() => {})
              }
              
              // 전환 효과 완료 확인
              if (videoTransitionOpacity < 1) {
                setVideoTransitionOpacity(1)
              }
            }
          }
          
          // 백그라운드 비디오 엘리먼트도 동기화
          if (!isNaN(video.duration) && video.duration > 0) {
            if (Math.abs(video.currentTime - videoTime) > 0.1) {
              video.currentTime = videoTime
            }
            if (video.paused && !audio.paused) {
              video.play().catch(() => {})
            }
          }
        } else {
          // 썸네일 시간이거나 영상 범위를 벗어난 경우
          if (previewVideoRef.current && !audio.paused) {
            previewVideoRef.current.pause()
          }
          if (foundVideoIndex === -1) {
            setCurrentVideoIndex(-1)
            setPreviousVideoIndex(-1)
          }
        }

        // 자막 업데이트 (썸네일 시간 제외)
        if (scriptLines.length > 0 && (!previewThumbnailImage || elapsed >= THUMBNAIL_DURATION)) {
          const currentLine = scriptLines.find(
            line => elapsedMs >= line.startTime && elapsedMs < line.endTime
          )
          
          if (currentLine) {
            // 의미 단위로 나눠 한 줄씩 순서대로 (쉼표·마침표 기준)
            const phrases = getSubtitlePhrases(currentLine.text)
            const lineDuration = currentLine.endTime - currentLine.startTime
            const timeInLine = elapsedMs - currentLine.startTime
            const phraseIndex = phrases.length <= 1 ? 0 : Math.min(Math.floor((timeInLine / lineDuration) * phrases.length), phrases.length - 1)
            setCurrentSubtitle(phrases[phraseIndex] ?? currentLine.text)
          } else {
            setCurrentSubtitle("")
          }
        } else {
          setCurrentSubtitle("")
        }
      })

      // 미리보기용 오디오 및 비디오 설정 (3개 영상)
      setPreviewAudio(audio)
      setPreviewVideoElements(videoElements)
            
      // video ref에 첫 번째 영상 설정 (초기값)
      if (previewVideoRef.current && videoElements.length > 0) {
        const firstVideo = videoElements[0]
        previewVideoRef.current.src = firstVideo.src
        previewVideoRef.current.crossOrigin = firstVideo.crossOrigin
        previewVideoRef.current.muted = firstVideo.muted
        previewVideoRef.current.playsInline = firstVideo.playsInline
        previewVideoRef.current.loop = false
        previewVideoRef.current.load()
      }

      setPreviewGenerated(true)
      setCurrentTime(0)
      setCurrentSubtitle("")
      console.log("[Shopping] 미리보기 생성 완료 (롱폼 방식)")
      alert("미리보기가 생성되었습니다! 재생 버튼을 눌러 확인하세요.")
    } catch (error) {
      const msg = error instanceof Error ? error.message : "알 수 없는 오류"
      console.error("미리보기 생성 실패:", error)
      setError(`미리보기 생성에 실패했습니다: ${msg}`)
      alert(`미리보기 생성 실패\n\n${msg}\n\nSafari에서는 WebM 영상이 지원되지 않을 수 있습니다. Chrome 등 다른 브라우저에서 시도해 보세요.`)
    } finally {
      setIsGeneratingPreview(false)
    }
  }

  // 미리보기 재생/일시정지 (롱폼 방식: onTimeUpdate 사용)
  const handlePreviewPlayPause = () => {
    if (!previewAudio) return

    if (isPlaying) {
      previewAudio.pause()
      // 비디오도 일시정지
      if (previewVideoRef.current) {
        previewVideoRef.current.pause()
      }
      // BGM 일시정지
      if (previewBgmAudio) {
        previewBgmAudio.pause()
      }
      // 효과음 일시정지
      if (previewSfxAudio) {
        previewSfxAudio.pause()
      }
      setIsPlaying(false)
    } else {
      previewAudio.play()
      setIsPlaying(true)
      
      // 비디오 재생 시작 (롱폼 방식: 단순하게)
      if (previewVideoRef.current) {
        previewVideoRef.current.loop = true
        previewVideoRef.current.currentTime = 0
        previewVideoRef.current.play().catch(() => {})
      }
      
      // 재생 시작 시점에 BGM과 효과음 체크 및 재생
      const elapsed = previewAudio.currentTime
      const audioDuration = previewAudio.duration
      
      // BGM 체크 및 재생 (종료 시간을 넘어간 경우 재생하지 않음)
      if (previewBgmAudio && bgmUrl && !previewAudio.ended && audioDuration > 0) {
        const bgmDuration = previewBgmAudio.duration
        if (isFinite(bgmDuration) && bgmDuration > 0) {
          // 종료 시간에 도달했거나 넘어갔거나 시작 시간 이전이면 재생하지 않음 (엄격한 체크)
          // bgmEndTime에 도달하면 즉시 정지 (예: 10초에 도달하면 정지)
          if (elapsed >= bgmEndTime || elapsed < bgmStartTime || elapsed >= audioDuration || previewAudio.ended) {
            // BGM이 재생 중이면 정지
            if (!previewBgmAudio.paused) {
              previewBgmAudio.pause()
              previewBgmAudio.currentTime = 0
            }
          } else if (elapsed >= bgmStartTime && elapsed < bgmEndTime && elapsed < audioDuration && !previewAudio.ended) {
            // BGM 재생 시간대 내에 있을 때만 재생 (elapsed < bgmEndTime - 종료 시간에 도달하면 재생하지 않음)
            const bgmOffset = elapsed - bgmStartTime
            const safeCurrentTime = Math.max(0, Math.min(bgmOffset % bgmDuration, bgmDuration))
            if (isFinite(safeCurrentTime)) {
              previewBgmAudio.currentTime = safeCurrentTime
              previewBgmAudio.play().catch(() => {})
            }
          } else {
            // BGM 재생 시간대 밖이면 무조건 정지
            if (!previewBgmAudio.paused) {
              previewBgmAudio.pause()
              previewBgmAudio.currentTime = 0
            }
          }
        }
      }
      
      // 효과음 체크 및 재생
      if (previewSfxAudio && sfxUrl && !previewAudio.ended && audioDuration > 0) {
        const sfxDuration = previewSfxAudio.duration
        if (isFinite(sfxDuration) && sfxDuration > 0) {
          if (elapsed >= sfxStartTime && elapsed < sfxEndTime && elapsed < audioDuration) {
            const sfxOffset = elapsed - sfxStartTime
            const safeCurrentTime = Math.max(0, Math.min(sfxOffset, sfxDuration))
            if (isFinite(safeCurrentTime)) {
              previewSfxAudio.currentTime = safeCurrentTime
              previewSfxAudio.play().catch(() => {})
            }
          }
        }
      }
    }
  }

  // blob을 GCS(숏폼 버킷)에 업로드 후 접근 가능한 URL 반환 (서버 다운로드용). 균일 버킷 수준 액세스 대응으로 읽기용 signed URL 사용.
  const uploadBlobToGcsShopping = async (blob: Blob, fileName: string, contentType: string): Promise<string> => {
    const ext = fileName.includes(".") ? fileName.split(".").pop() : "bin"
    const safeName = `${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}_${Date.now()}.${ext}`
    const res = await fetch("/api/upload-to-gcs/signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: safeName, contentType, scope: "shopping" }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Signed URL 실패: ${res.status}`)
    }
    const { signedUrl, fileName: storedFileName } = await res.json()
    const putRes = await fetch(signedUrl, { method: "PUT", body: blob, headers: { "Content-Type": contentType } })
    if (!putRes.ok) throw new Error("GCS 업로드 실패")
    // 균일 버킷 수준 액세스에서는 makePublic() 불가 → 읽기용 signed URL 사용 (Cloud Run이 이 URL로 fetch)
    const readRes = await fetch("/api/upload-to-gcs/signed-read-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: storedFileName, scope: "shopping" }),
    })
    if (!readRes.ok) {
      const err = await readRes.json().catch(() => ({}))
      throw new Error(err.error || "읽기 URL 생성 실패")
    }
    const { readUrl } = await readRes.json()
    return readUrl
  }

  // 서버 다운로드: 미리보기 데이터(TTS, 자막, 영상3개, 썸네일, BGM/효과음)를 Cloud Run으로 보내 렌더 후 다운로드
  const handleServerDownload = async () => {
    if (!previewGenerated || !previewAudio || convertedVideoUrls.size !== 3 || !ttsAudioUrl) {
      alert("미리보기를 먼저 생성하고, TTS와 영상 3개가 준비되어 있어야 합니다.")
      return
    }
    const durationSec = previewAudio.duration
    if (!isFinite(durationSec) || durationSec <= 0) {
      alert("오디오 길이를 확인할 수 없습니다. 미리보기를 다시 생성해주세요.")
      return
    }
    const thumbSrc = selectedThumbnailIndex >= 0 && thumbnailImages[selectedThumbnailIndex]
      ? thumbnailImages[selectedThumbnailIndex].url
      : thumbnailUrl || ""
    if (!thumbSrc) {
      alert("썸네일을 선택하거나 생성해주세요.")
      return
    }
    if (scriptLines.length === 0) {
      alert("자막 데이터가 없습니다. 미리보기를 다시 생성해주세요.")
      return
    }

    setIsServerDownloading(true)
    setError("")
    try {
      const durationPerVideo = durationSec / 3

      const getBlobFromUrl = async (url: string): Promise<Blob> => {
        if (url.startsWith("data:")) {
          const res = await fetch(url)
          return res.blob()
        }
        const res = await fetch(url)
        if (!res.ok) throw new Error(`다운로드 실패: ${url}`)
        return res.blob()
      }

      // 1) TTS 오디오 업로드
      const ttsBlob = await getBlobFromUrl(ttsAudioUrl)
      const audioGcsUrl = await uploadBlobToGcsShopping(ttsBlob, "tts_audio", ttsBlob.type || "audio/mpeg")

      // 2) 영상 3개 업로드
      const videoUrls: string[] = []
      for (let i = 0; i < 3; i++) {
        const url = convertedVideoUrls.get(i)
        if (!url) throw new Error(`영상 ${i + 1}이 없습니다.`)
        const blob = await getBlobFromUrl(url)
        const gcsUrl = await uploadBlobToGcsShopping(blob, `segment_${i}`, blob.type || "video/webm")
        videoUrls.push(gcsUrl)
      }

      // 3) 썸네일 업로드
      const thumbBlob = await getBlobFromUrl(thumbSrc)
      const thumbnailImageUrl = await uploadBlobToGcsShopping(thumbBlob, "thumbnail", thumbBlob.type || "image/jpeg")

      // 4) BGM / 효과음 (선택)
      let bgmGcsUrl: string | null = null
      let sfxGcsUrl: string | null = null
      if (bgmUrl) {
        try {
          const b = await getBlobFromUrl(bgmUrl)
          bgmGcsUrl = await uploadBlobToGcsShopping(b, "bgm", b.type || "audio/mpeg")
        } catch (e) {
          console.warn("[서버 다운로드] BGM 업로드 실패, BGM 없이 진행:", e)
        }
      }
      if (sfxUrl) {
        try {
          const b = await getBlobFromUrl(sfxUrl)
          sfxGcsUrl = await uploadBlobToGcsShopping(b, "sfx", b.type || "audio/mpeg")
        } catch (e) {
          console.warn("[서버 다운로드] 효과음 업로드 실패, 효과음 없이 진행:", e)
        }
      }

      // 미리보기처럼 TTS에 맞춰 한 줄(phrase)씩 시간대로 전달 (getSubtitlePhrases로 나눈 뒤 구간별 start/end 부여)
      const subtitles: { start: number; end: number; text: string }[] = []
      for (const line of scriptLines) {
        const startSec = line.startTime / 1000
        const endSec = line.endTime / 1000
        const phrases = getSubtitlePhrases(line.text)
        if (phrases.length <= 0) continue
        const span = endSec - startSec
        phrases.forEach((phrase, i) => {
          const pStart = startSec + (span * i) / phrases.length
          const pEnd = startSec + (span * (i + 1)) / phrases.length
          subtitles.push({ start: pStart, end: pEnd, text: phrase })
        })
      }

      const videoSegments = [
        { url: videoUrls[0], startTime: 0, endTime: durationPerVideo },
        { url: videoUrls[1], startTime: durationPerVideo, endTime: durationPerVideo * 2 },
        { url: videoUrls[2], startTime: durationPerVideo * 2, endTime: durationSec },
      ]

      const body: Record<string, unknown> = {
        type: "shopping",
        duration: durationSec,
        audioGcsUrl,
        subtitles,
        thumbnailImageUrl,
        videoSegments,
        config: { width: 1080, height: 1920, fps: 30 },
      }
      if (bgmGcsUrl) {
        body.bgmUrl = bgmGcsUrl
        body.bgmStartTime = bgmStartTime
        body.bgmEndTime = bgmEndTime
      }
      if (sfxGcsUrl) {
        body.sfxUrl = sfxGcsUrl
        body.sfxStartTime = sfxStartTime
        body.sfxEndTime = sfxEndTime
      }

      const renderRes = await fetch("/api/ai/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!renderRes.ok) {
        const errData = await renderRes.json().catch(() => ({}))
        throw new Error(errData.error || `렌더 요청 실패: ${renderRes.status}`)
      }
      const result = await renderRes.json()
      const videoUrl = result.videoUrl
      const videoBase64 = result.videoBase64

      let blob: Blob
      if (videoUrl) {
        const videoRes = await fetch(videoUrl)
        if (!videoRes.ok) throw new Error("렌더된 영상 다운로드 실패")
        blob = await videoRes.blob()
      } else if (videoBase64) {
        const binary = atob(videoBase64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        blob = new Blob([bytes], { type: "video/mp4" })
      } else {
        throw new Error("응답에 videoUrl 또는 videoBase64가 없습니다.")
      }

      // 사용자 기기로 영상 저장 (모바일: 공유/새 창 열기, PC: 다운로드)
      const fileName = `${(factoryAutoRunItem?.productName || productName) || "shopping"}_server_${Date.now()}.mp4`
      const downloadUrl = URL.createObjectURL(blob)
      const mobile = typeof navigator !== "undefined" && (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (typeof window !== "undefined" && window.innerWidth <= 768))
      if (mobile) {
        // 모바일: Web Share API로 저장/공유 유도, 실패 시 새 창에서 열어 길게 눌러 저장
        const file = new File([blob], fileName, { type: "video/mp4" })
        const shared = typeof navigator !== "undefined" && navigator.share && (navigator.canShare?.({ files: [file] }) ?? true)
        if (shared) {
          try {
            await navigator.share({ files: [file], title: fileName, text: "렌더링된 영상" })
            if (!factoryAutoRunItem) alert("공유 화면에서 '저장' 또는 '파일에 저장'을 선택하세요.")
          } catch (e) {
            if ((e as Error)?.name !== "AbortError") {
              window.open(downloadUrl, "_blank")
              if (!factoryAutoRunItem) alert("영상이 새 창에서 열렸습니다.\n재생 화면을 길게 눌러 '동영상 저장' 또는 '다운로드'를 선택하세요.")
            }
          }
        } else {
          window.open(downloadUrl, "_blank")
          if (!factoryAutoRunItem) alert("영상이 새 창에서 열렸습니다.\n재생 화면을 길게 눌러 '동영상 저장' 또는 '다운로드'를 선택하세요.")
        }
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000)
      } else {
        const a = document.createElement("a")
        a.href = downloadUrl
        a.download = fileName
        a.click()
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000)
        if (!factoryAutoRunItem) alert("서버 렌더링이 완료되었습니다. 다운로드가 시작됩니다.")
      }

      // 공장 자동화 모드: 서버에서 받은 영상으로 저장 후 유튜브 자동 업로드
      if (factoryAutoRunItem) {
        await saveShotFormScheduleVideoBlob(factoryAutoRunItem.id, blob)
        let youtubeUploaded = false
        // 업로드 시 제목·설명이 비어 있으면 미리 생성 (자동 진행 시 state가 비어 있을 수 있음)
        let uploadTitle = youtubeTitle?.trim() || factoryAutoRunItem.productName
        let uploadDescription = youtubeDescription?.trim() || ""
        let uploadTags = youtubeTags?.length ? youtubeTags : []
        if (!youtubeTitle?.trim() || !youtubeDescription?.trim()) {
          try {
            const openaiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined
            const meta = await generateYouTubeMetadata(
              factoryAutoRunItem.productName,
              factoryAutoRunItem.productDescription || "",
              script,
              openaiKey
            )
            uploadTitle = meta.title || uploadTitle
            uploadDescription = meta.description || uploadDescription
            uploadTags = meta.tags?.length ? meta.tags : uploadTags
          } catch (metaErr) {
            console.warn("[Factory] 유튜브 메타데이터 생성 실패:", metaErr)
          }
        }
        if (youtubeChannelName) {
          try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const r = new FileReader()
            r.onload = () => {
              const s = r.result as string
              resolve(s.includes(",") ? s.split(",")[1] : s)
            }
            r.onerror = reject
            r.readAsDataURL(blob)
          })
          const [y, m, d] = factoryAutoRunItem.scheduledDate.split("-").map(Number)
          const [h, min] = (factoryAutoRunItem.scheduledTime || "09:00").split(":").map(Number)
          const scheduledDateTime = new Date(y, m - 1, d, h, min)
          const clientId = typeof window !== "undefined" ? localStorage.getItem("shopping_factory_youtube_client_id") : null
          const clientSecret = typeof window !== "undefined" ? localStorage.getItem("shopping_factory_youtube_client_secret") : null
          const uploadRes = await fetch("/api/youtube/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videoUrl: "blob:",
              videoBase64: base64,
              title: uploadTitle,
              description: uploadDescription,
              tags: uploadTags,
              scheduledTime: scheduledDateTime.toISOString(),
              clientId: clientId || undefined,
              clientSecret: clientSecret || undefined,
            }),
          })
          const uploadData = await uploadRes.json().catch(() => ({}))
          if (uploadRes.ok && uploadData.success) {
            youtubeUploaded = true
            alert(`유튜브 예약 업로드가 완료되었습니다.\n${uploadData.message || ""}`)
          } else {
            alert(`유튜브 업로드 실패: ${uploadData.error || uploadRes.statusText}`)
          }
          } catch (e) {
            alert(`유튜브 자동 업로드 중 오류: ${e instanceof Error ? e.message : "알 수 없음"}`)
          }
        }
        const updatedItem = {
          ...factoryAutoRunItem,
          status: "ready" as const,
          videoBlobId: factoryAutoRunItem.id,
          youtubeTitle: uploadTitle,
          youtubeDescription: uploadDescription,
          youtubeTags: uploadTags,
          youtubeUploaded,
        }
        persistFactorySchedules(factorySchedules.map((s) => (s.id === factoryAutoRunItem.id ? updatedItem : s)))
        if (!youtubeChannelName) {
          alert("공장 예약 완료. 공장 자동화 목록에서 다운로드할 수 있습니다.")
        }
      }

      // 공장 자동화 모드였으면 완료 후 목록으로
      if (factoryAutoRunItem) {
        setFactoryAutoRunItem(null)
        setShowProjectList(true)
        setShowFactoryView(true)
      }
    } catch (err) {
      console.error("[서버 다운로드] 실패:", err)
      const msg = err instanceof Error ? err.message : String(err)
      setError(`서버 다운로드 실패: ${msg}`)
      alert(`서버 다운로드에 실패했습니다.\n\n${msg}`)
    } finally {
      setIsServerDownloading(false)
    }
  }

  // 최종 영상 렌더링 (미리보기와 동일). 예약 발행 시 onComplete로 blob 전달 후 저장.
  const handleRenderVideo = async (options?: { onComplete?: (blob: Blob) => void }) => {
    // 3개의 개별 영상이 모두 준비되어야 함
    if (convertedVideoUrls.size !== 3 || !ttsAudioUrl || !canvasRef.current) {
      alert("3개의 영상과 TTS가 모두 준비되어야 합니다.")
      return
    }
    
    if (!previewGenerated || !previewAudio) {
      alert("먼저 미리보기를 생성해주세요.")
      return
    }

    setIsRendering(true)
    setError("")
    try {
      console.log("[Shopping] 최종 영상 렌더링 시작 (미리보기와 동일한 방식)")

      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        throw new Error("Canvas context를 생성할 수 없습니다.")
      }

      // Canvas 크기를 1080x1920으로 설정
      canvas.width = 1080
      canvas.height = 1920

      // 미리보기에서 사용하는 오디오 재사용
      const audio = previewAudio
      
      // 오디오 시간 초기화
      audio.currentTime = 0
      const actualAudioDuration = audio.duration
      console.log("[Shopping] 실제 오디오 길이:", actualAudioDuration.toFixed(3), "초")

      // 3개의 개별 영상 엘리먼트 생성 및 로드
      const videoElements: HTMLVideoElement[] = []
      const videoDurations: number[] = []
      
      // TTS 길이를 3으로 나눈 값 계산
      const durationPerVideo = Math.round(actualAudioDuration / 3)
      
      for (let i = 0; i < 3; i++) {
        const videoUrl = convertedVideoUrls.get(i)
        if (!videoUrl) {
          throw new Error(`영상 ${i + 1}이 준비되지 않았습니다.`)
        }
        
        const video = document.createElement("video")
        video.src = videoUrl
        video.crossOrigin = "anonymous"
        // 모바일에서 더 나은 버퍼링을 위해 preload 설정
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                        (typeof window !== "undefined" && window.innerWidth <= 768)
        video.preload = isMobile ? "metadata" : "auto"
        video.muted = true
        video.playsInline = true
        
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => {
            const duration = video.duration || durationPerVideo
            videoDurations.push(duration)
            console.log(`[Shopping] 영상 ${i + 1} 로드 완료, 길이: ${duration.toFixed(2)}초`)
            resolve()
          }
          // 모바일에서 버퍼링 개선
          if (isMobile) {
            video.oncanplaythrough = () => {
              const duration = video.duration || durationPerVideo
              if (!videoDurations.includes(duration)) {
                videoDurations.push(duration)
              }
            }
          }
          video.onerror = reject
          video.load()
          
          // 모바일에서는 타임아웃을 더 길게
          if (isMobile) {
            setTimeout(() => {
              if (video.readyState >= 1) {
                const duration = video.duration || durationPerVideo
                if (!videoDurations.includes(duration)) {
                  videoDurations.push(duration)
                }
                resolve()
              }
            }, 15000)
          }
        })
        
        videoElements.push(video)
      }

      console.log("[Shopping] 3개 영상 로드 완료, 각 영상 길이:", videoDurations.map(d => d.toFixed(2) + "초"))

      // MediaRecorder 설정 (롱폼 쇼츠 생성기 방식)
      // 부드러운 렌더링을 위해 30fps로 설정
      const stream = canvas.captureStream(30)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const source = audioContext.createMediaElementSource(audio)
      
      // TTS 볼륨 조절
      const ttsGainNode = audioContext.createGain()
      ttsGainNode.gain.value = ttsVolume
      source.connect(ttsGainNode)
      
      // BGM 추가 (있는 경우) - bgmUrl만 있으면 추가 (파일 업로드 또는 라이브러리 선택 모두)
      let bgmGainNode: GainNode | null = null
      let bgmSource: MediaElementAudioSourceNode | null = null
      let bgmAudioElement: HTMLAudioElement | null = null
      if (bgmUrl) {
        bgmAudioElement = new Audio(bgmUrl)
        bgmAudioElement.loop = false // 시간대에 맞게 재생하므로 loop 해제
        bgmAudioElement.volume = bgmVolume
        bgmAudioElement.preload = "auto"
        bgmAudioElement.crossOrigin = "anonymous"
        
        // BGM 오디오 로드 대기
        await new Promise<void>((resolve, reject) => {
          if (!bgmAudioElement) {
            resolve()
            return
          }
          bgmAudioElement.onloadeddata = () => {
            console.log("[Shopping] BGM 로드 완료")
            resolve()
          }
          bgmAudioElement.onerror = (e) => {
            console.warn("[Shopping] BGM 로드 실패, 계속 진행:", e)
            bgmAudioElement = null
            resolve() // BGM이 없어도 계속 진행
          }
          bgmAudioElement.load()
        })
        
        if (bgmAudioElement) {
          bgmSource = audioContext.createMediaElementSource(bgmAudioElement)
          bgmGainNode = audioContext.createGain()
          bgmGainNode.gain.value = bgmVolume
          bgmSource.connect(bgmGainNode)
        }
      }
      
      // 효과음 추가 (있는 경우)
      let sfxGainNode: GainNode | null = null
      let sfxSource: MediaElementAudioSourceNode | null = null
      let sfxAudioElement: HTMLAudioElement | null = null
      if (sfxUrl) {
        sfxAudioElement = new Audio(sfxUrl)
        sfxAudioElement.loop = false
        sfxAudioElement.volume = sfxVolume
        sfxAudioElement.preload = "auto"
        sfxAudioElement.crossOrigin = "anonymous"
        
        // 효과음 오디오 로드 대기
        await new Promise<void>((resolve, reject) => {
          if (!sfxAudioElement) {
            resolve()
            return
          }
          sfxAudioElement.onloadeddata = () => {
            console.log("[Shopping] 효과음 로드 완료")
            resolve()
          }
          sfxAudioElement.onerror = (e) => {
            console.warn("[Shopping] 효과음 로드 실패, 계속 진행:", e)
            sfxAudioElement = null
            resolve() // 효과음이 없어도 계속 진행
          }
          sfxAudioElement.load()
        })
        
        if (sfxAudioElement) {
          sfxSource = audioContext.createMediaElementSource(sfxAudioElement)
          sfxGainNode = audioContext.createGain()
          sfxGainNode.gain.value = sfxVolume
          sfxSource.connect(sfxGainNode)
        }
      }
      
      const destination = audioContext.createMediaStreamDestination()
      ttsGainNode.connect(destination)
      if (bgmGainNode) {
        bgmGainNode.connect(destination)
      }
      if (sfxGainNode) {
        sfxGainNode.connect(destination)
      }

      const videoTrack = stream.getVideoTracks()[0]
      const audioTrack = destination.stream.getAudioTracks()[0]
      const combinedStream = new MediaStream([videoTrack, audioTrack])

      // 부드러운 렌더링을 위한 MediaRecorder 설정 (Safari/iOS는 vp9 미지원 → 폴백으로 끊김 방지)
      const recOptions: { mimeType?: string; videoBitsPerSecond?: number } = { videoBitsPerSecond: 5000000 }
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
          recOptions.mimeType = "video/webm;codecs=vp9,opus"
        } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
          recOptions.mimeType = "video/webm;codecs=vp8,opus"
        } else if (MediaRecorder.isTypeSupported("video/webm")) {
          recOptions.mimeType = "video/webm"
        }
      }
      const mediaRecorder = new MediaRecorder(combinedStream, recOptions)
      const recordedMimeType = recOptions.mimeType || "video/webm"

      const chunks: Blob[] = []
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: recordedMimeType })
        const onComplete = options?.onComplete
        if (onComplete) {
          onComplete(videoBlob)
          console.log("[Shopping] 영상 렌더링 완료 (예약 발행 저장용)")
          setIsRendering(false)
          return
        }
        const videoUrlForDownload = URL.createObjectURL(videoBlob)
        // 모바일 기기 감지
        const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                      (window.innerWidth <= 768)
        if (mobile) {
          console.log("[Shopping] 영상 렌더링 완료 (모바일)")
          setVideoUrl(videoUrlForDownload)
          setIsRendering(false)
          alert("영상 렌더링이 완료되었습니다.\n\n다운로드 버튼을 눌러 영상을 저장하세요.")
        } else {
        const a = document.createElement("a")
          a.href = videoUrlForDownload
        a.download = `${productName || "shopping"}_video_${Date.now()}.webm`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
          setTimeout(() => URL.revokeObjectURL(videoUrlForDownload), 1000)
        console.log("[Shopping] 영상 렌더링 및 다운로드 완료")
        setIsRendering(false)
        }
      }

      // 썸네일 이미지 로드 (있는 경우) - 미리보기에서 사용한 것 재사용
      let thumbnailImage: HTMLImageElement | null = previewThumbnailImage

      // AudioContext가 suspended 상태면 resume
      if (audioContext.state === "suspended") {
        await audioContext.resume()
        console.log("[Shopping] AudioContext resumed")
      }

      // 렌더링 시작 (롱폼 쇼츠 생성기 방식)
      mediaRecorder.start()
      audio.play()
      
      // BGM과 효과음이 AudioContext를 통해 재생되도록 확인
      console.log("[Shopping] 렌더링 시작 - BGM:", bgmUrl ? "있음" : "없음", "효과음:", sfxUrl ? "있음" : "없음")

      // 롱폼 쇼츠 생성기 방식으로 렌더링 (썸네일 + 3개 영상 순차 재생)
      // 미리보기와 완전히 동일한 로직 사용
      const THUMBNAIL_DURATION = 0.0001 // 미리보기와 동일하게 0.0001초
      let scriptLinesToUse = scriptLines

      // 각 영상의 시작 시간 계산 (미리보기와 동일한 방식)
      let accumulatedTime = 0
      const videoStartTimes: number[] = []
      for (let i = 0; i < videoDurations.length; i++) {
        videoStartTimes.push(accumulatedTime)
        accumulatedTime += videoDurations[i]
      }

      console.log("[Shopping] 렌더링 - 각 영상의 시작 시간:", videoStartTimes.map(t => t.toFixed(2) + "초"))

      let lastVideoIndex = -1 // 미리보기와 동일하게 lastVideoIndex 사용

      const renderFrame = () => {
        const elapsed = audio.currentTime

        // BGM 시간대 체크 및 재생/정지 (렌더링 중에도 동기화)
        if (bgmAudioElement && bgmUrl) {
          // bgmEndTime을 넘어갔거나 bgmStartTime 이전이면 무조건 정지
          if (elapsed >= bgmEndTime || elapsed < bgmStartTime) {
            if (!bgmAudioElement.paused) {
              bgmAudioElement.pause()
              bgmAudioElement.currentTime = 0
            }
          } else if (elapsed >= bgmStartTime && elapsed < bgmEndTime) {
            // BGM 재생 시간대 내에 있을 때만 재생
            if (bgmAudioElement.paused) {
              // BGM 시작 시간에 맞춰 오디오 위치 설정
              const bgmOffset = elapsed - bgmStartTime
              const bgmDuration = bgmAudioElement.duration
              if (isFinite(bgmDuration) && bgmDuration > 0) {
                const safeCurrentTime = Math.max(0, Math.min(bgmOffset % bgmDuration, bgmDuration))
                if (isFinite(safeCurrentTime)) {
                  bgmAudioElement.currentTime = safeCurrentTime
                  bgmAudioElement.play().catch(() => {})
                }
              }
            } else {
              // 재생 중일 때도 시간 동기화 (0.1초 이상 차이나면)
              const bgmOffset = elapsed - bgmStartTime
              const bgmDuration = bgmAudioElement.duration
              if (isFinite(bgmDuration) && bgmDuration > 0) {
                const targetTime = Math.max(0, Math.min(bgmOffset % bgmDuration, bgmDuration))
                if (Math.abs(bgmAudioElement.currentTime - targetTime) > 0.1) {
                  bgmAudioElement.currentTime = targetTime
                }
              }
            }
          }
        }

        // 효과음 시간대 체크 및 재생/정지 (렌더링 중에도 동기화)
        if (sfxAudioElement && sfxUrl) {
          if (elapsed >= sfxStartTime && elapsed < sfxEndTime) {
            // 효과음 재생 시간대 내에 있을 때만 재생
            if (sfxAudioElement.paused) {
              // 효과음 시작 시간에 맞춰 오디오 위치 설정
              const sfxOffset = elapsed - sfxStartTime
              const sfxDuration = sfxAudioElement.duration
              if (isFinite(sfxDuration) && sfxDuration > 0) {
                const safeCurrentTime = Math.max(0, Math.min(sfxOffset, sfxDuration))
                if (isFinite(safeCurrentTime)) {
                  sfxAudioElement.currentTime = safeCurrentTime
                  sfxAudioElement.play().catch(() => {})
                }
              }
            }
          } else {
            // 효과음 시간대 밖이면 정지
            if (!sfxAudioElement.paused) {
              sfxAudioElement.pause()
              sfxAudioElement.currentTime = 0
            }
          }
        }

        // 캔버스 초기화
        ctx.fillStyle = "black"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // 썸네일이 있고 0.0001초 이하일 때 썸네일 표시 (미리보기와 동일)
        const adjustedElapsed = Math.max(0, elapsed - THUMBNAIL_DURATION) // 미리보기와 동일하게 adjustedElapsed 사용
        
        if (thumbnailImage && elapsed < THUMBNAIL_DURATION) {
          ctx.drawImage(thumbnailImage, 0, 0, canvas.width, canvas.height)
        } else {
          // 썸네일 시간이 지나면 기존 영상 표시 (미리보기와 동일)
          // 현재 시간에 맞는 영상 찾기 (썸네일 시간 제외)
          let currentVideoIndex = -1
          for (let i = 0; i < videoStartTimes.length; i++) {
            const startTime = videoStartTimes[i]
            const endTime = i < videoStartTimes.length - 1 ? videoStartTimes[i + 1] : startTime + videoDurations[i]
            
            if (adjustedElapsed >= startTime && adjustedElapsed < endTime) {
              currentVideoIndex = i
              break
            }
          }

          // 비디오 전환 시에만 처리 (미리보기와 동일)
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
              const videoElapsed = adjustedElapsed - videoStartTime
              
              if (video && !isNaN(video.duration) && video.duration > 0) {
                // 시작 시간 설정
                video.currentTime = Math.max(0, Math.min(videoElapsed, video.duration))
                // 비디오 재생 (자체적으로 재생되도록)
                video.play().catch(() => {})
              }
            }
            
            lastVideoIndex = currentVideoIndex
          }

          // 현재 영상을 캔버스에 그리기 (렌더링 최적화: 매 프레임마다 동기화, 비율 유지)
          if (currentVideoIndex >= 0 && videoElements[currentVideoIndex]) {
            const currentVideo = videoElements[currentVideoIndex]
            const videoStartTime = videoStartTimes[currentVideoIndex]
            const videoElapsed = adjustedElapsed - videoStartTime
            
            // 렌더링 시에는 매 프레임마다 비디오 시간을 오디오에 맞춰 동기화 (부드러운 재생을 위해)
            if (currentVideo && !isNaN(currentVideo.duration) && currentVideo.duration > 0) {
              const targetTime = Math.max(0, Math.min(videoElapsed, currentVideo.duration))
              // 시간 차이가 0.1초 이상이면 동기화 (너무 자주 설정하지 않도록)
              if (Math.abs(currentVideo.currentTime - targetTime) > 0.1) {
                currentVideo.currentTime = targetTime
              }
              
              // 비디오가 일시정지되어 있으면 재생
              if (currentVideo.paused) {
                currentVideo.play().catch(() => {})
              }
            }
            
            try {
              if (currentVideo.readyState >= 2 || (currentVideo.videoWidth > 0 && currentVideo.videoHeight > 0)) {
                const videoWidth = currentVideo.videoWidth
                const videoHeight = currentVideo.videoHeight
                const canvasWidth = canvas.width
                const canvasHeight = canvas.height
                
                // 비디오와 캔버스의 비율 계산
                const videoAspect = videoWidth / videoHeight
                const canvasAspect = canvasWidth / canvasHeight
                
                let drawWidth = canvasWidth
                let drawHeight = canvasHeight
                let drawX = 0
                let drawY = 0
                
                // 비율에 맞춰 중앙 크롭 (cover 방식)
                if (videoAspect > canvasAspect) {
                  // 비디오가 더 넓음 - 높이에 맞추고 좌우 크롭
                  drawHeight = canvasHeight
                  drawWidth = drawHeight * videoAspect
                  drawX = (canvasWidth - drawWidth) / 2
                } else {
                  // 비디오가 더 높음 - 너비에 맞추고 상하 크롭
                  drawWidth = canvasWidth
                  drawHeight = drawWidth / videoAspect
                  drawY = (canvasHeight - drawHeight) / 2
                }
                
                ctx.drawImage(currentVideo, 0, 0, videoWidth, videoHeight, drawX, drawY, drawWidth, drawHeight)
              }
            } catch (e) {
              // 그리기 실패 시 무시
            }
          }
        }

        // 자막 그리기 (썸네일 시간 동안에는 표시하지 않음) - 미리보기와 동일
        if (scriptLinesToUse.length > 0 && (!thumbnailImage || elapsed >= THUMBNAIL_DURATION)) {
          const elapsedMs = adjustedElapsed * 1000 // adjustedElapsed 사용
          const currentLine = scriptLinesToUse.find(
            line => elapsedMs >= line.startTime && elapsedMs < line.endTime
          )
          
          if (currentLine) {
            // 의미 단위로 나눠 한 줄씩 순서대로 (쉼표·마침표 기준)
            const phrases = getSubtitlePhrases(currentLine.text)
            const lineDuration = currentLine.endTime - currentLine.startTime
            const timeInLine = elapsedMs - currentLine.startTime
            const phraseIndex = phrases.length <= 1 ? 0 : Math.min(Math.floor((timeInLine / lineDuration) * phrases.length), phrases.length - 1)
            const textToShow = phrases[phraseIndex] || currentLine.text
            // 자막 위치 계산 (subtitleStyle 설정 반영)
            // 캔버스 크기: 1080x1920, 미리보기 크기: 533px 기준
            // 미리보기에서는 fontSize * 0.6을 사용하므로, 렌더링에서도 동일한 비율 적용
            const previewHeight = 533 // 미리보기 높이 (px)
            const scaleFactor = canvas.height / previewHeight // 스케일 팩터 계산
            let baseY: number
            if (subtitleStyle.position === "top") {
              baseY = canvas.height * 0.15
            } else if (subtitleStyle.position === "center") {
              baseY = canvas.height * 0.5
            } else {
              baseY = canvas.height * 0.85
            }
            // positionOffset을 캔버스 크기에 맞게 스케일링
            const offsetY = subtitleStyle.positionOffset * scaleFactor
            const subtitleY = baseY + offsetY
            
            // 자막 스타일 적용 (미리보기와 동일한 비율: fontSize * 0.6 * scaleFactor)
            const fontSize = subtitleStyle.fontSize * 0.6 * scaleFactor
            ctx.font = `${subtitleStyle.fontWeight} ${fontSize}px '${subtitleStyle.fontFamily}', sans-serif`
            ctx.textAlign = subtitleStyle.textAlign
            ctx.textBaseline = "middle"
            
            // 텍스트 크기 측정 (배경 그리기용)
            const textMetrics = ctx.measureText(textToShow)
            const textWidth = textMetrics.width
            const textHeight = fontSize
            const padding = fontSize * 0.2 // 패딩 계산
            
            // 배경 그리기 (backgroundColor가 투명도가 있으면)
            if (subtitleStyle.backgroundColor && subtitleStyle.backgroundColor !== "transparent") {
              const bgColor = subtitleStyle.backgroundColor
              ctx.fillStyle = bgColor
              
              // 텍스트 정렬에 따라 배경 위치 조정
              let bgX: number
              if (subtitleStyle.textAlign === "center") {
                bgX = canvas.width / 2 - textWidth / 2 - padding
              } else if (subtitleStyle.textAlign === "right") {
                bgX = canvas.width - textWidth - padding * 2
              } else {
                bgX = padding
              }
              
              const bgY = subtitleY - textHeight / 2 - padding
              const bgWidth = textWidth + padding * 2
              const bgHeight = textHeight + padding * 2
              
              // 둥근 모서리 배경 (간단한 사각형으로 대체)
              ctx.fillRect(bgX, bgY, bgWidth, bgHeight)
            }
            
            // 텍스트 그림자 (textShadow가 true인 경우)
            if (subtitleStyle.textShadow) {
              ctx.shadowColor = "rgba(0, 0, 0, 0.8)"
              ctx.shadowBlur = fontSize * 0.1
              ctx.shadowOffsetX = fontSize * 0.02
              ctx.shadowOffsetY = fontSize * 0.02
            } else {
              ctx.shadowColor = "transparent"
              ctx.shadowBlur = 0
              ctx.shadowOffsetX = 0
              ctx.shadowOffsetY = 0
            }
            
            // 텍스트 정렬에 따라 X 위치 계산
            let textX: number
            if (subtitleStyle.textAlign === "center") {
              textX = canvas.width / 2
            } else if (subtitleStyle.textAlign === "right") {
              textX = canvas.width - padding
            } else {
              textX = padding
            }
            
            // 자막 텍스트 그리기
            ctx.fillStyle = subtitleStyle.color
            ctx.fillText(textToShow, textX, subtitleY)
          }
        }

        // 다음 프레임 요청 (롱폼 쇼츠 생성기 방식)
        if (!audio.paused && elapsed < actualAudioDuration) {
          requestAnimationFrame(renderFrame)
        } else {
          // 렌더링 종료 시 BGM 및 효과음 정리
          if (bgmAudioElement) {
            bgmAudioElement.pause()
            bgmAudioElement.currentTime = 0
          }
          if (sfxAudioElement) {
            sfxAudioElement.pause()
            sfxAudioElement.currentTime = 0
          }
          mediaRecorder.stop()
          audio.pause()
        }
      }

      renderFrame()
    } catch (error) {
      console.error("영상 렌더링 실패:", error)
      setError(`영상 렌더링에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
      setIsRendering(false)
    }
  }

  // 1개 이미지를 3분할 영상으로 변환 (제품영상 4초, 확대영상 4초, 다른 각도 4초)
  const handleConvertAllImagesToVideos = async () => {
    if (imageUrls.length !== 3) {
      alert("이미지 3개가 준비되어야 합니다.")
      return
    }

    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined
    const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined

    if (!replicateApiKey) {
      alert("Replicate API 키가 필요합니다. 메인 화면의 설정(톱니바퀴 아이콘)에서 API 키를 입력해주세요.")
      return
    }

    // 즉시 로딩 상태 표시 (모든 영상에 대해)
    setIsGeneratingVideoPrompts((prev) => {
      const newMap = new Map(prev)
      newMap.set(0, true)
      newMap.set(1, true)
      newMap.set(2, true)
      return newMap
    })
    setIsConvertingToVideo((prev) => {
      const newMap = new Map(prev)
      newMap.set(0, true)
      newMap.set(1, true)
      newMap.set(2, true)
      return newMap
    })

    setError("")
    
    try {
      // TTS 길이 계산 (오디오 메타데이터를 우선 사용)
      let totalTtsDuration = 12 // 기본값 12초
      
      // 1순위: 오디오 메타데이터 사용 (가장 정확함)
      if (ttsAudioUrl) {
        try {
          const audio = new Audio(ttsAudioUrl)
          await new Promise((resolve, reject) => {
            audio.onloadedmetadata = () => {
              totalTtsDuration = Math.ceil(audio.duration)
              console.log(`[Shopping] ✅ TTS 길이: ${totalTtsDuration}초 (오디오 메타데이터 기반, 실제 길이: ${audio.duration.toFixed(2)}초)`)
              resolve(undefined)
            }
            audio.onerror = reject
            audio.load()
          })
        } catch (audioError) {
          console.warn("[Shopping] TTS 오디오 길이 가져오기 실패, scriptLines 사용:", audioError)
        }
      }
      
      // 2순위: scriptLines 사용 (오디오 메타데이터가 없을 때만)
      if (totalTtsDuration === 12 && scriptLines && scriptLines.length > 0) {
        const lastLine = scriptLines[scriptLines.length - 1]
        const scriptLinesDuration = Math.ceil(lastLine.endTime / 1000)
        // scriptLines의 endTime이 비정상적으로 크면 무시 (예: 37초)
        if (scriptLinesDuration <= 60) { // 최대 60초까지만 허용
          totalTtsDuration = scriptLinesDuration
          console.log(`[Shopping] ⚠️ TTS 길이: ${totalTtsDuration}초 (scriptLines 기반, 오디오 메타데이터 없음)`)
        } else {
          console.warn(`[Shopping] ⚠️ scriptLines의 endTime이 비정상적입니다 (${scriptLinesDuration}초). 기본값 사용.`)
        }
      }
      
      // 각 이미지당 영상 길이 계산 (TTS 길이를 3으로 나누고 반올림)
      // CRITICAL: 각 영상은 반드시 TTS 길이 / 3으로 고정되어야 함
      const durationPerVideo = Math.round(totalTtsDuration / 3)
      
      // durationPerVideo가 유효한지 확인 (0보다 커야 함)
      if (!durationPerVideo || durationPerVideo <= 0) {
        throw new Error(`영상 길이 계산 오류: durationPerVideo=${durationPerVideo}초 (TTS: ${totalTtsDuration}초)`)
      }
      
      console.log(`[Shopping] 📊 TTS 길이 계산 결과:`)
      console.log(`  - TTS 전체 길이: ${totalTtsDuration}초`)
      console.log(`  - 각 이미지당 duration: ${totalTtsDuration} / 3 = ${(totalTtsDuration / 3).toFixed(2)}초`)
      console.log(`  - 반올림된 duration: ${durationPerVideo}초`)
      console.log(`  - 총 영상 길이 (예상): ${durationPerVideo * 3}초`)
      console.log(`  - ⚠️ CRITICAL: 각 영상은 반드시 ${durationPerVideo}초로 생성되어야 합니다. TTS 전체 길이(${totalTtsDuration}초)가 아닙니다!`)
      
      // 각 영상의 sample_shift 계산 (각 영상 길이에 맞게)
      const sampleShiftPerVideo = Math.max(8, Math.min(16, durationPerVideo))
      
      console.log(`[Shopping] 3개 이미지를 영상으로 변환 시작 (TTS: ${totalTtsDuration}초, 각 영상: ${durationPerVideo}초, sample_shift: ${sampleShiftPerVideo})`)
      
      const videoResults: Array<{ index: number; videoUrl: string; duration: number; sceneType: string }> = []
      const newVideoMap = new Map<number, string>()
      const sceneNames = ["제품 사용 영상", "디테일 영상", "다른 배경 영상"]
      
      // 기존에 생성된 영상이 있으면 유지
      const existingVideos = new Map(convertedVideoUrls)
      
      // 1단계: 모든 이미지에 대한 프롬프트를 먼저 생성 (OpenAI API 활용)
      console.log(`[Shopping] 📝 1단계: 영상 프롬프트 생성 시작 (OpenAI API 활용)`)
      const videoPromptsMap = new Map<number, string>()
      
      for (let i = 0; i < 3; i++) {
        // 이미 생성된 영상이 있으면 프롬프트도 건너뛰기 (기존 프롬프트가 있으면 사용)
        if (existingVideos.has(i) && videoPrompts.has(i)) {
          console.log(`[Shopping] ⏭️ ${sceneNames[i]} 프롬프트 이미 존재, 건너뜀`)
          videoPromptsMap.set(i, videoPrompts.get(i)!)
          continue
        }
        
        // 프롬프트 생성 중 상태 업데이트
        setIsGeneratingVideoPrompts((prev) => {
          const newMap = new Map(prev)
          newMap.set(i, true)
          return newMap
        })
        
        try {
          console.log(`[Shopping] 🤖 ${sceneNames[i]} 프롬프트 생성 중... (${i + 1}/3)`)
          
          // OpenAI API를 활용하여 제품 행동 프롬프트 생성
          const videoPrompt = await generateVideoPromptForImage(
            i as 0 | 1 | 2,
            productName,
            productDescription,
            durationPerVideo,
            openaiApiKey // AI 행동 프롬프트 생성용 API 키
          )
          
          console.log(`[Shopping] ✅ ${sceneNames[i]} 프롬프트 생성 완료`)
          console.log(`[Shopping] 📄 프롬프트 내용 (${sceneNames[i]}):`, videoPrompt.substring(0, 200) + "...")
          
          // 프롬프트 저장
          videoPromptsMap.set(i, videoPrompt)
          setVideoPrompts((prev) => {
            const newMap = new Map(prev)
            newMap.set(i, videoPrompt)
            return newMap
          })
        } catch (error) {
          console.error(`[Shopping] ❌ ${sceneNames[i]} 프롬프트 생성 실패:`, error)
          setError(`${sceneNames[i]} 프롬프트 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
          throw error
        } finally {
          setIsGeneratingVideoPrompts((prev) => {
            const newMap = new Map(prev)
            newMap.set(i, false)
            return newMap
          })
        }
      }
      
      console.log(`[Shopping] ✅ 모든 프롬프트 생성 완료! 이제 영상을 생성합니다.`)
      
      // 2단계: 생성된 프롬프트를 사용하여 영상 생성
      console.log(`[Shopping] 🎬 2단계: 영상 생성 시작`)
      
      for (let i = 0; i < 3; i++) {
        // 이미 생성된 영상이 있으면 건너뛰기
        if (existingVideos.has(i)) {
          console.log(`[Shopping] ⏭️ ${sceneNames[i]} 이미 생성됨, 건너뜀`)
          newVideoMap.set(i, existingVideos.get(i)!)
          videoResults.push({
            index: i,
            videoUrl: existingVideos.get(i)!,
            duration: durationPerVideo,
            sceneType: sceneNames[i]
          })
          continue
        }
        
        const imageUrl = imageUrls[i]
        const videoPrompt = videoPromptsMap.get(i)
        
        if (!videoPrompt) {
          console.error(`[Shopping] ❌ ${sceneNames[i]} 프롬프트가 없습니다.`)
          throw new Error(`${sceneNames[i]} 프롬프트가 생성되지 않았습니다.`)
        }
        
        // 변환 시작 상태 업데이트
        setIsConvertingToVideo((prev) => {
          const newMap = new Map(prev)
          newMap.set(i, true)
          console.log(`[Shopping] 🔄 ${sceneNames[i]} 변환 상태 업데이트: true (인덱스 ${i})`)
          return newMap
        })
        
        console.log(`[Shopping] 📹 ${sceneNames[i]} 영상 생성 시작 (${i + 1}/3)`)
        console.log(`[Shopping] ⚠️ CRITICAL: 각 영상 길이 = ${durationPerVideo}초 (TTS 전체: ${totalTtsDuration}초 / 3 = ${(totalTtsDuration / 3).toFixed(2)}초)`)
        console.log(`[Shopping] ⚠️ CRITICAL: 이 영상은 반드시 ${durationPerVideo}초로 생성되어야 합니다. TTS 전체 길이(${totalTtsDuration}초)가 아닙니다!`)
        console.log(`[Shopping] 📄 사용할 프롬프트:`, videoPrompt.substring(0, 200) + "...")
        
        // 이미지를 영상으로 변환 (bytedance/seedance-1-pro-fast 모델 사용, duration 사용)
        // CRITICAL: durationPerVideo는 반드시 TTS/3으로 계산된 값이어야 함
        if (durationPerVideo !== Math.round(totalTtsDuration / 3)) {
          console.error(`[Shopping] ❌ CRITICAL ERROR: durationPerVideo가 올바르지 않습니다!`)
          console.error(`  - durationPerVideo: ${durationPerVideo}초`)
          console.error(`  - 예상 값 (TTS/3): ${Math.round(totalTtsDuration / 3)}초`)
          console.error(`  - TTS 전체: ${totalTtsDuration}초`)
          throw new Error(`영상 길이 계산 오류: durationPerVideo=${durationPerVideo}초, 예상=${Math.round(totalTtsDuration / 3)}초`)
        }
        
        try {
          const videoUrl = await generateVideoWithSeedance(
            imageUrl,
            videoPrompt,
            durationPerVideo, // duration 전달 (반드시 TTS/3)
            replicateApiKey
          )
          
          console.log(`[Shopping] ✅ ${sceneNames[i]} 생성 완료:`, videoUrl)
          
          // 변환된 영상 URL 저장 및 즉시 표시
          newVideoMap.set(i, videoUrl)
          setConvertedVideoUrls(new Map(newVideoMap))
          
          videoResults.push({
            index: i,
            videoUrl,
            duration: durationPerVideo, // 계산된 duration 사용
            sceneType: sceneNames[i]
          })
        } catch (error) {
          console.error(`[Shopping] ❌ ${sceneNames[i]} 생성 실패:`, error)
          throw error
        } finally {
          // 상태 업데이트는 finally에서 확실히 수행
          setIsConvertingToVideo((prev) => {
            const newMap = new Map(prev)
            newMap.set(i, false)
            // 모든 영상이 완료되었는지 확인
            const allComplete = Array.from(newMap.values()).every(v => v === false)
            console.log(`[Shopping] 🔄 ${sceneNames[i]} 변환 상태 업데이트: false (인덱스 ${i}), 모든 영상 완료: ${allComplete}, 현재 상태:`, Array.from(newMap.entries()))
            return newMap
          })
        }
      }
      
      // 영상 합치기 기능 제거 - 개별 영상 3개만 사용
      const totalVideoDuration = videoResults.reduce((sum, result) => sum + result.duration, 0)
      console.log(`[Shopping] 3개 영상 변환 완료 (각 영상: ${durationPerVideo}초, 총 ${totalVideoDuration.toFixed(1)}초, TTS: ${totalTtsDuration}초)`)
      
      // 모든 영상이 저장되었는지 확인하고 최종 업데이트
      if (newVideoMap.size === 3) {
        console.log(`[Shopping] ✅ 모든 영상이 성공적으로 저장되었습니다 (${newVideoMap.size}/3)`)
        // 최종 상태 업데이트 (모든 영상이 확실히 저장되도록)
        setConvertedVideoUrls(new Map(newVideoMap))
      } else {
        console.warn(`[Shopping] ⚠️ 영상 저장 상태 확인: ${newVideoMap.size}/3`)
      }
      
      // 모든 변환 상태 확실히 초기화 (모든 영상 완료 후)
      // 상태 업데이트가 완료될 시간을 주고 확실히 초기화
      await new Promise(resolve => setTimeout(resolve, 200)) // 상태 업데이트가 완료될 시간을 줌
      setIsConvertingToVideo((prev) => {
        // 모든 값이 false인지 확인하고 빈 Map으로 초기화
        const allFalse = Array.from(prev.values()).every(v => v === false)
        if (allFalse || prev.size === 0) {
          console.log(`[Shopping] 🔄 모든 변환 상태 초기화 완료 (이전 상태: ${prev.size}개 항목)`)
          return new Map()
        }
        // 혹시 모를 경우를 위해 모든 항목을 false로 설정
        const clearedMap = new Map<number, boolean>()
        console.log(`[Shopping] 🔄 모든 변환 상태를 false로 설정 후 초기화`)
        return clearedMap
      })
    } catch (error) {
      console.error("[Shopping] ❌ 영상 변환 실패:", error)
      setError(`영상 변환에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
      
      // 에러 발생 시 모든 변환 상태 초기화
      setIsConvertingToVideo(new Map())
      setIsMergingVideos(false)
      console.log(`[Shopping] 🔄 에러 발생으로 인한 모든 상태 초기화 완료`)
    }
  }

  // 개별 영상 재생성
  const handleRegenerateSingleVideo = async (index: 0 | 1 | 2) => {
    if (imageUrls.length <= index) {
      alert("해당 이미지가 없습니다.")
      return
    }

    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined
    const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined

    if (!replicateApiKey) {
      alert("Replicate API 키가 필요합니다. 메인 화면의 설정(톱니바퀴 아이콘)에서 API 키를 입력해주세요.")
      return
    }

    // 즉시 로딩 상태 표시
    setIsGeneratingVideoPrompts((prev) => {
      const newMap = new Map(prev)
      newMap.set(index, true)
      return newMap
    })
    setIsConvertingToVideo((prev) => {
      const newMap = new Map(prev)
      newMap.set(index, true)
      return newMap
    })

    setError("")
    
    // 장면 이름 정의 (try-catch 블록에서 모두 사용 가능하도록 함수 상단에 정의)
    const sceneNames = ["제품 사용 영상", "디테일 영상", "다른 배경 영상"]
    
    try {
      // TTS 길이 계산
      let totalTtsDuration = 12
      if (ttsAudioUrl) {
        try {
          const audio = new Audio(ttsAudioUrl)
          await new Promise((resolve, reject) => {
            audio.onloadedmetadata = () => {
              totalTtsDuration = Math.ceil(audio.duration)
              resolve(undefined)
            }
            audio.onerror = reject
            audio.load()
          })
        } catch (audioError) {
          console.warn("[Shopping] TTS 오디오 길이 가져오기 실패:", audioError)
        }
      }
      
      // 각 이미지당 영상 길이 계산
      // CRITICAL: 각 영상은 반드시 TTS 길이 / 3으로 고정되어야 함
      const durationPerVideo = Math.round(totalTtsDuration / 3)
      
      // durationPerVideo가 유효한지 확인 (0보다 커야 함)
      if (!durationPerVideo || durationPerVideo <= 0) {
        throw new Error(`영상 길이 계산 오류: durationPerVideo=${durationPerVideo}초 (TTS: ${totalTtsDuration}초)`)
      }
      
      console.log(`[Shopping] ⚠️ CRITICAL: 각 영상은 반드시 ${durationPerVideo}초로 생성되어야 합니다. TTS 전체 길이(${totalTtsDuration}초)가 아닙니다!`)
      
      // 1단계: 프롬프트 먼저 생성 (OpenAI API 활용)
      console.log(`[Shopping] 📝 1단계: ${sceneNames[index]} 프롬프트 생성 시작 (OpenAI API 활용)`)
      
      let videoPrompt: string
      try {
        console.log(`[Shopping] 🤖 ${sceneNames[index]} 프롬프트 생성 중...`)
      
        // OpenAI API를 활용하여 제품 행동 프롬프트 생성
        videoPrompt = await generateVideoPromptForImage(
        index,
        productName,
        productDescription,
        durationPerVideo,
        openaiApiKey
      )
        
        console.log(`[Shopping] ✅ ${sceneNames[index]} 프롬프트 생성 완료`)
        console.log(`[Shopping] 📄 프롬프트 내용:`, videoPrompt.substring(0, 200) + "...")
        
        // 프롬프트 저장
        setVideoPrompts((prev) => {
          const newMap = new Map(prev)
          newMap.set(index, videoPrompt)
          return newMap
        })
      } catch (error) {
        console.error(`[Shopping] ❌ ${sceneNames[index]} 프롬프트 생성 실패:`, error)
        setError(`${sceneNames[index]} 프롬프트 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
        throw error
      } finally {
        setIsGeneratingVideoPrompts((prev) => {
          const newMap = new Map(prev)
          newMap.set(index, false)
          return newMap
        })
      }
      
      // 2단계: 생성된 프롬프트를 사용하여 영상 생성
      console.log(`[Shopping] 🎬 2단계: ${sceneNames[index]} 영상 생성 시작`)
      
      // 프롬프트 생성 완료, 이제 영상 생성 단계
      setIsGeneratingVideoPrompts((prev) => {
        const newMap = new Map(prev)
        newMap.set(index, false)
        return newMap
      })
      
      console.log(`[Shopping] 📹 ${sceneNames[index]} 재생성 시작 (길이: ${durationPerVideo}초)`)
      console.log(`[Shopping] 📄 사용할 프롬프트:`, videoPrompt.substring(0, 200) + "...")
      
      // 이미지를 영상으로 변환
      const imageUrl = imageUrls[index]
      const videoUrl = await generateVideoWithSeedance(
        imageUrl,
        videoPrompt,
        durationPerVideo,
        replicateApiKey
      )
      
      console.log(`[Shopping] ✅ ${sceneNames[index]} 재생성 완료:`, videoUrl)
      
      // 변환된 영상 URL 저장 및 즉시 표시
      setConvertedVideoUrls((prev) => {
        const newMap = new Map(prev)
        newMap.set(index, videoUrl)
        return newMap
      })
      
    } catch (error) {
      console.error(`[Shopping] ❌ ${sceneNames[index]} 재생성 실패:`, error)
      setError(`영상 재생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      // 상태 업데이트
      setIsConvertingToVideo((prev) => {
        const newMap = new Map(prev)
        newMap.set(index, false)
        return newMap
      })
    }
  }

  // 개별 장면을 영상으로 변환 (레거시 - 호환성 유지)
  const handleConvertImageToVideo = async (sceneIndex: number) => {
    if (imageUrls.length === 0) {
      alert("이미지가 준비되어야 합니다.")
      return
    }

    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined

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

      // 대본이 있으면 해당 장면의 대본 사용, 없으면 기본 프롬프트
      let scenePrompt: string
      let duration: number | undefined
      
      if (script.trim() && scenes.length > sceneIndex) {
        const sceneScript = scenes[sceneIndex]
        const charactersPerSecond = 6.7
        duration = Math.max(3, Math.ceil(sceneScript.length / charactersPerSecond))
        scenePrompt = `${productName} product in use. ${sceneScript}. Smooth motion, natural movement, duration: ${duration} seconds. CRITICAL - PRODUCT VISIBILITY: The product must ALWAYS be fully visible in the frame throughout the entire video. The product must NEVER disappear, move out of frame, or become partially hidden. The product must stay in the center of the frame and remain fully visible from start to finish. The product must remain within the frame boundaries at all times. ABSOLUTELY CRITICAL - PRODUCT SHAPE PRESERVATION: The product's shape, form, and structure must remain EXACTLY the same as the input image throughout the entire video. The product must NEVER be deformed, distorted, broken, cracked, bent, warped, or changed in any way. Even when hands are using the product, the product must maintain its exact rigid form and physical integrity. Hands must NOT cause the product to deform or change shape. High quality, professional video, 9:16 vertical format.`
      } else {
        scenePrompt = scenes[sceneIndex] || `Product showcase scene ${sceneIndex + 1}. CRITICAL - PRODUCT VISIBILITY: The product must ALWAYS be fully visible in the frame throughout the entire video. The product must NEVER disappear, move out of frame, or become partially hidden. The product must stay in the center of the frame and remain fully visible from start to finish.`
      }
      
      const videoUrl = await convertImageToVideoWithWan(
        imageUrls[sceneIndex],
        scenePrompt,
        undefined,
        replicateApiKey,
        duration
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

  // 모바일 기기 감지
  const isMobile = () => {
    if (typeof window === "undefined") return false
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           (window.innerWidth <= 768)
  }

  // 비디오 다운로드 (모바일 대응)
  // 예약 발행 모달 열기 (기본값: 내일 09:00)
  const handleOpenScheduleModal = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setScheduleDate(tomorrow.toISOString().slice(0, 10))
    setScheduleTime("09:00")
    setScheduleModalOpen(true)
  }

  // 예약 발행 확정: 영상 렌더 후 blob 저장 → 목록에 추가
  const handleConfirmSchedule = async () => {
    if (!scheduleDate || !scheduleTime) {
      alert("발행 날짜와 시간을 선택해주세요.")
      return
    }
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`)
    if (scheduledAt <= new Date()) {
      alert("발행 일시는 현재보다 미래로 설정해주세요.")
      return
    }
    const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const newItem: ShoppingScheduleItem = {
      id: scheduleId,
      productName: productName || "제품",
      productDescription: productDescription || undefined,
      scheduleAt: scheduledAt.toISOString(),
      createdAt: new Date().toISOString(),
      status: "scheduled",
    }
    setIsScheduling(true)
    try {
      await handleRenderVideo({
        onComplete: async (blob) => {
          await saveShotFormScheduleVideoBlob(scheduleId, blob)
          setScheduledItems((prev) => {
            const next = [...prev, newItem]
            localStorage.setItem(SHOTFORM_SCHEDULES_STORAGE_KEY, JSON.stringify(next))
            return next
          })
          setScheduleModalOpen(false)
          setIsScheduling(false)
          alert("예약 발행이 등록되었습니다. 해당 날짜에 예약 목록에서 다운로드할 수 있습니다.")
        },
      })
    } catch (e) {
      setIsScheduling(false)
      setScheduleModalOpen(false)
      alert("예약 발행 처리 중 오류가 발생했습니다.")
    }
  }

  // 예약 목록에서 영상 다운로드 (모바일: 공유/새 창)
  const handleDownloadScheduled = async (item: ShoppingScheduleItem) => {
    const blob = await getShotFormScheduleVideoBlob(item.id)
    if (!blob) {
      alert("저장된 영상을 찾을 수 없습니다.")
      return
    }
    const fileName = `${item.productName}_예약_${item.id.slice(0, 12)}.webm`
    const url = URL.createObjectURL(blob)
    const mobile = isMobile()
    if (mobile) {
      const file = new File([blob], fileName, { type: blob.type || "video/webm" })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: fileName })
        } catch (e) {
          if ((e as Error)?.name !== "AbortError") window.open(url, "_blank")
        }
      } else {
        window.open(url, "_blank")
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } else {
      const a = document.createElement("a")
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    }
  }

  // 예약 항목 삭제
  const handleRemoveScheduled = (item: ShoppingScheduleItem) => {
    if (!confirm(`"${item.productName}" 예약을 삭제할까요?`)) return
    deleteShotFormScheduleVideoBlob(item.id).catch(() => {})
    persistScheduledItems(scheduledItems.filter((s) => s.id !== item.id))
  }

  const factoryPipelineScriptStartedRef = useRef(false)
  const factoryServerDownloadTriggeredRef = useRef<string | null>(null)
  const factoryPreviewAutoTriggeredRef = useRef<string | null>(null)

  // 공장 자동화: 해당 날짜 도래 시 수동으로 영상 생성 시작 (제작 화면으로 이동)
  const startFactoryPipeline = (item: FactoryScheduleItem) => {
    persistFactorySchedules(factorySchedules.map((s) => (s.id === item.id ? { ...s, status: "generating" as const } : s)))
    setProductName(item.productName)
    setProductDescription(item.productDescription || "")
    setProductImage(item.productImageBase64)
    setSelectedVoiceId(item.voiceId)
    if (item.voiceId.startsWith("supertone-")) {
      setSelectedSupertoneVoiceId(item.voiceId.replace("supertone-", ""))
    }
    setShowFactoryView(false)
    setShowProjectList(false)
    setActiveStep("product")
    setFactoryAutoRunItem(item)
    factoryPipelineScriptStartedRef.current = false
  }

  // 공장 자동화: 상품 클릭 시 수동 모드로 진입 (프로젝트 있으면 불러오기, 없으면 제품 정보만 로드). 썸네일은 AI 생성으로 설정.
  const openFactoryItemInManualMode = async (item: FactoryScheduleItem, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      const target = e.target as HTMLElement
      if (target.closest("button")) return
    }
    setFactoryAutoRunItem(null)
    setThumbnailMode("ai")
    if (item.projectId) {
      try {
        const project = await getShoppingProject(item.projectId)
        if (project) {
          const data = project.data
          if (data.productName) setProductName(data.productName)
          if (data.productDescription) setProductDescription(data.productDescription)
          if (data.productImage) {
            setProductImage(data.productImage)
            const img = new Image()
            img.onload = () => setProductImageAspectRatio(img.width / img.height)
            img.src = data.productImage
          }
          if (data.videoDuration) setVideoDuration(data.videoDuration)
          if (data.script) setScript(data.script)
          if (data.editedScript) setEditedScript(data.editedScript)
          if (data.selectedVoiceId) setSelectedVoiceId(data.selectedVoiceId)
          if (data.selectedSupertoneVoiceId) setSelectedSupertoneVoiceId(data.selectedSupertoneVoiceId)
          if (data.selectedSupertoneStyle) setSelectedSupertoneStyle(data.selectedSupertoneStyle)
          setTtsAudioUrl(data.ttsAudioUrl && data.ttsAudioUrl.trim() ? data.ttsAudioUrl : "")
          if (data.imageUrls) setImageUrls(data.imageUrls)
          if (data.imagePrompts) {
            setImagePrompts(data.imagePrompts)
            setPromptsGenerated(data.imagePrompts.length > 0)
          }
          if (data.convertedVideoUrls) {
            const videoMap = new Map<number, string>()
            data.convertedVideoUrls.forEach(({ index, videoUrl }) => videoMap.set(index, videoUrl))
            setConvertedVideoUrls(videoMap)
          }
          if (data.videoUrl) setVideoUrl(data.videoUrl)
          if (data.subtitleStyle) setSubtitleStyle({ ...data.subtitleStyle, positionOffset: data.subtitleStyle?.positionOffset ?? 0 })
          if (data.bgmUrl) setBgmUrl(data.bgmUrl)
          if (data.bgmVolume !== undefined) setBgmVolume(data.bgmVolume)
          if (data.bgmStartTime !== undefined) setBgmStartTime(data.bgmStartTime)
          if (data.bgmEndTime !== undefined) setBgmEndTime(data.bgmEndTime)
          if (data.sfxUrl) setSfxUrl(data.sfxUrl)
          if (data.sfxVolume !== undefined) setSfxVolume(data.sfxVolume)
          if (data.sfxStartTime !== undefined) setSfxStartTime(data.sfxStartTime)
          if (data.sfxEndTime !== undefined) setSfxEndTime(data.sfxEndTime)
          if (data.ttsVolume !== undefined) setTtsVolume(data.ttsVolume)
          if (data.transitionEffect) setTransitionEffect(data.transitionEffect)
          if (data.transitionDuration !== undefined) setTransitionDuration(data.transitionDuration)
          if (data.youtubeTitle) setYoutubeTitle(data.youtubeTitle)
          if (data.youtubeDescription) setYoutubeDescription(data.youtubeDescription)
          if (data.youtubeTags) setYoutubeTags(data.youtubeTags)
          if (data.thumbnailUrl) setThumbnailUrl(data.thumbnailUrl)
          if (data.thumbnailHookingText) setThumbnailHookingText(data.thumbnailHookingText)
          if (data.thumbnailImages) setThumbnailImages(data.thumbnailImages)
          if (data.selectedThumbnailIndex !== undefined) setSelectedThumbnailIndex(data.selectedThumbnailIndex)
          if (data.activeStep) setActiveStep(data.activeStep)
          setCurrentProject(project)
        } else {
          setProductName(item.productName)
          setProductDescription(item.productDescription || "")
          setProductImage(item.productImageBase64)
          setSelectedVoiceId(item.voiceId)
          if (item.voiceId.startsWith("supertone-")) setSelectedSupertoneVoiceId(item.voiceId.replace("supertone-", ""))
          setActiveStep("product")
          setCurrentProject(null)
        }
      } catch (err) {
        console.warn("[Factory] 프로젝트 불러오기 실패, 제품 정보만 로드:", err)
        setProductName(item.productName)
        setProductDescription(item.productDescription || "")
        setProductImage(item.productImageBase64)
        setSelectedVoiceId(item.voiceId)
        if (item.voiceId.startsWith("supertone-")) setSelectedSupertoneVoiceId(item.voiceId.replace("supertone-", ""))
        setActiveStep("product")
        setCurrentProject(null)
      }
    } else {
      setProductName(item.productName)
      setProductDescription(item.productDescription || "")
      setProductImage(item.productImageBase64)
      setSelectedVoiceId(item.voiceId)
      if (item.voiceId.startsWith("supertone-")) setSelectedSupertoneVoiceId(item.voiceId.replace("supertone-", ""))
      setActiveStep("product")
      setCurrentProject(null)
    }
    setShowFactoryView(false)
    setShowProjectList(false)
  }

  // 공장 자동화: 백그라운드에서 전체 파이프라인 실행 (화면 전환 없이 공장 자동화에 머물며 진행 상황만 표시)
  // 각 단계 완료 시 자동으로 프로젝트 생성·저장
  const runFactoryPipelineInBackground = async (item: FactoryScheduleItem) => {
    let projectId: string | null = item.projectId || null

    const updatePhase = (phase: string, status?: "generating" | "ready" | "failed", errorMessage?: string) => {
      setFactorySchedules((prev) => {
        const next = prev.map((s) =>
          s.id === item.id ? { ...s, phase, status: status ?? s.status, errorMessage } : s
        )
        localStorage.setItem(FACTORY_SCHEDULES_STORAGE_KEY, JSON.stringify(next))
        return next
      })
    }
    const setItemProjectId = (pid: string) => {
      projectId = pid
      setFactorySchedules((prev) => {
        const next = prev.map((s) => (s.id === item.id ? { ...s, projectId: pid } : s))
        localStorage.setItem(FACTORY_SCHEDULES_STORAGE_KEY, JSON.stringify(next))
        return next
      })
    }
    const saveProjectStep = async (dataPartial: Partial<ShoppingProjectData>) => {
      if (!projectId) return
      try {
        const proj = await getShoppingProject(projectId)
        const merged: ShoppingProjectData = { ...(proj?.data || {}), ...dataPartial }
        await updateShoppingProject(projectId, { data: merged })
      } catch (e) {
        console.warn("[Factory] 프로젝트 단계 저장 실패:", e)
      }
    }

    try {
      const openaiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined
      const replicateKey = typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined
      if (!openaiKey) {
        updatePhase("product", "failed", "OpenAI API 키가 없습니다.")
        return
      }

      updatePhase("script")
      const script = await generateShoppingScript(
        item.productName,
        item.productDescription ? `${item.productName}. ${item.productDescription}` : item.productName,
        openaiKey
      )
      const scenes = await splitScriptIntoScenes(script)
      if (scenes.length < 3) {
        updatePhase("script", "failed", "대본 분할 실패")
        return
      }

      // 대본 완료 시: 프로젝트 자동 생성 및 1단계 저장
      if (userId) {
        try {
          if (!projectId) {
            const projectName = `${item.productName} (예약 ${item.scheduledDate} ${item.scheduledTime || "00:00"})`
            const initialData: ShoppingProjectData = {
              productName: item.productName,
              productDescription: item.productDescription,
              productImage: item.productImageBase64 ?? undefined,
              script,
              videoDuration: 12,
              selectedVoiceId: item.voiceId,
              activeStep: "script",
            }
            const newProject = await createShoppingProject(userId, projectName, undefined, initialData)
            projectId = newProject.id
            setItemProjectId(newProject.id)
          } else {
            await saveProjectStep({ script, activeStep: "script" })
          }
        } catch (e) {
          console.warn("[Factory] 프로젝트 생성/저장 실패:", e)
        }
      }

      updatePhase("video")
      if (!replicateKey) {
        updatePhase("video", "failed", "Replicate API 키가 없습니다.")
        return
      }
      // 메인 플로우와 동일하게 이미지용 프롬프트를 먼저 생성 (대본 텍스트를 그대로 쓰면 nano-banana가 실패함)
      let imagePromptsForFactory: Array<{ type: string; prompt: string; description: string; scriptText: string }> = []
      try {
        imagePromptsForFactory = await generateImagePromptsFromScript(
          script,
          item.productName,
          item.productDescription || "",
          item.productImageBase64 || undefined,
          openaiKey
        )
      } catch (promptErr) {
        console.warn("[Factory] 이미지 프롬프트 생성 실패, 장면 텍스트로 대체:", promptErr)
      }
      const imageUrls: string[] = []
      for (let i = 0; i < 3; i++) {
        const promptToUse =
          imagePromptsForFactory[i]?.prompt?.trim() && imagePromptsForFactory[i].prompt.length > 30
            ? imagePromptsForFactory[i].prompt
            : scenes[i]
        const url = await generateImageWithNanobanana(
          promptToUse,
          item.productName,
          item.productImageBase64 || undefined,
          replicateKey,
          i,
          item.productDescription,
          "9:16"
        )
        imageUrls.push(url)
      }
      await saveProjectStep({ imageUrls, activeStep: "video" })

      updatePhase("tts")
      const ttsText = script.trim()
      let ttsResponse: Response
      const voiceId = item.voiceId
      if (voiceId.startsWith("ttsmaker-")) {
        const voiceName = voiceId.replace("ttsmaker-", "")
        const pitch = voiceName === "남성5" ? 0.9 : 1.0
        const ttsmakerKey = localStorage.getItem("shotform_ttsmaker_api_key") || undefined
        if (!ttsmakerKey) {
          updatePhase("tts", "failed", "TTSMaker API 키가 없습니다.")
          return
        }
        ttsResponse = await fetch("/api/ttsmaker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: ttsText, voice: voiceName, speed: 1.0, pitch, apiKey: ttsmakerKey }),
        })
      } else if (voiceId.startsWith("supertone-")) {
        const sid = voiceId.replace("supertone-", "")
        const supertoneKey = (localStorage.getItem("shotform_supertone_api_key") || "").trim()
        if (!supertoneKey) {
          updatePhase("tts", "failed", "수퍼톤 API 키가 없습니다.")
          return
        }
        ttsResponse = await fetch("/api/supertone-tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: ttsText, voiceId: sid, apiKey: supertoneKey, style: "neutral", language: "ko" }),
        })
      } else if (voiceId.startsWith("elevenlabs-")) {
        const eid = voiceId.replace("elevenlabs-", "")
        const elevenKey = (localStorage.getItem("shotform_elevenlabs_api_key") || "").trim()
        if (!elevenKey) {
          updatePhase("tts", "failed", "ElevenLabs API 키가 없습니다.")
          return
        }
        ttsResponse = await fetch("/api/elevenlabs-tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: ttsText, voiceId: eid, apiKey: elevenKey }),
        })
      } else {
        updatePhase("tts", "failed", "지원하지 않는 목소리입니다.")
        return
      }
      if (!ttsResponse.ok) {
        const err = await ttsResponse.json().catch(() => ({}))
        updatePhase("tts", "failed", err.error || "TTS 생성 실패")
        return
      }
      const ttsData = await ttsResponse.json()
      if (!ttsData.success || (!ttsData.audioBase64 && !ttsData.audioUrl)) {
        updatePhase("tts", "failed", ttsData.error || "TTS 오디오 없음")
        return
      }
      let audioBlob: Blob
      if (ttsData.audioBase64) {
        const bytes = Uint8Array.from(atob(ttsData.audioBase64), (c) => c.charCodeAt(0))
        audioBlob = new Blob([bytes], { type: "audio/mpeg" })
      } else {
        const ar = await fetch(ttsData.audioUrl)
        audioBlob = await ar.blob()
      }
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const arrayBuffer = await audioBlob.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      const actualAudioDuration = audioBuffer.duration
      const wavBuffer = audioBufferToWav(audioBuffer)
      const wavBlob = new Blob([wavBuffer], { type: "audio/wav" })
      const ttsBlobUrl = URL.createObjectURL(wavBlob)
      let ttsAudioUrlForProject = ttsBlobUrl
      if (userId && projectId) {
        try {
          ttsAudioUrlForProject = await uploadTTSAudio(wavBlob, projectId, userId)
          await saveProjectStep({ ttsAudioUrl: ttsAudioUrlForProject })
        } catch (e) {
          console.warn("[Factory] TTS 업로드/저장 실패:", e)
        }
      }
      const totalChars = script.length
      const scriptLines: ScriptLine[] = []
      let currentTime = 0
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i]
        const sentences = scene.split(/[.!?。！？]\s*/).filter((s) => s.trim().length > 0)
        for (const sentence of sentences) {
          const len = sentence.trim().length
          const duration = (len / totalChars) * actualAudioDuration * 1000
          scriptLines.push({
            id: scriptLines.length + 1,
            text: sentence.trim(),
            startTime: currentTime,
            endTime: currentTime + duration,
          })
          currentTime += duration
        }
      }

      updatePhase("render")
      const videoUrls: string[] = []
      for (let i = 0; i < 3; i++) {
        const vurl = await convertImageToVideoWithWan(imageUrls[i], scenes[i], undefined, replicateKey)
        videoUrls.push(vurl)
      }
      await saveProjectStep({
        convertedVideoUrls: videoUrls.map((url, index) => ({ index, videoUrl: url })),
        activeStep: "render",
      })

      updatePhase("thumbnail")
      let thumbUrl: string
      try {
        const hookingText = await generateThumbnailHookingText(item.productName, openaiKey)
        thumbUrl = await generateShortsThumbnail(
          item.productName,
          replicateKey,
          item.productImageBase64 ?? undefined,
          hookingText
        )
        await saveProjectStep({
          thumbnailUrl: thumbUrl,
          thumbnailHookingText: hookingText,
          thumbnailImages: [{ url: thumbUrl, text: hookingText, isCustom: false }],
          selectedThumbnailIndex: 0,
          activeStep: "thumbnail",
        })
      } catch (thumbErr) {
        console.warn("[Factory] AI 썸네일 생성 실패, 상품 이미지로 진행:", thumbErr)
        thumbUrl = item.productImageBase64?.startsWith("data:")
          ? item.productImageBase64
          : item.productImageBase64
            ? `data:image/jpeg;base64,${item.productImageBase64}`
            : ""
      }
      if (!thumbUrl) {
        throw new Error("썸네일을 생성할 수 없고 상품 이미지도 없습니다.")
      }

      updatePhase("preview")
      await saveProjectStep({ activeStep: "preview" })

      // 썸네일 완료 후 곧바로 서버 렌더만 수행 → PC 다운로드 → 유튜브 업로드 (클라이언트 미리보기 생략)
      const durationSec = actualAudioDuration
      const getBlobFromUrl = async (url: string): Promise<Blob> => {
        if (url.startsWith("data:")) {
          const res = await fetch(url)
          return res.blob()
        }
        const res = await fetch(url)
        if (!res.ok) throw new Error(`다운로드 실패: ${url}`)
        return res.blob()
      }
      const ttsBlob = await getBlobFromUrl(ttsBlobUrl)
      const audioGcsUrl = await uploadBlobToGcsShopping(ttsBlob, "tts_audio", ttsBlob.type || "audio/mpeg")
      const gcsVideoUrls: string[] = []
      for (let i = 0; i < 3; i++) {
        const b = await getBlobFromUrl(videoUrls[i])
        const gcsUrl = await uploadBlobToGcsShopping(b, `segment_${i}`, b.type || "video/webm")
        gcsVideoUrls.push(gcsUrl)
      }
      const thumbBlob = await getBlobFromUrl(thumbUrl)
      const thumbnailImageUrl = await uploadBlobToGcsShopping(thumbBlob, "thumbnail", thumbBlob.type || "image/jpeg")
      const subtitles: { start: number; end: number; text: string }[] = []
      for (const line of scriptLines) {
        const startSec = line.startTime / 1000
        const endSec = line.endTime / 1000
        const phrases = getSubtitlePhrases(line.text)
        if (phrases.length <= 0) continue
        const span = endSec - startSec
        phrases.forEach((phrase, i) => {
          const pStart = startSec + (span * i) / phrases.length
          const pEnd = startSec + (span * (i + 1)) / phrases.length
          subtitles.push({ start: pStart, end: pEnd, text: phrase })
        })
      }
      const durationPerVideo = durationSec / 3
      const body = {
        type: "shopping",
        duration: durationSec,
        audioGcsUrl,
        subtitles,
        thumbnailImageUrl,
        videoSegments: [
          { url: gcsVideoUrls[0], startTime: 0, endTime: durationPerVideo },
          { url: gcsVideoUrls[1], startTime: durationPerVideo, endTime: durationPerVideo * 2 },
          { url: gcsVideoUrls[2], startTime: durationPerVideo * 2, endTime: durationSec },
        ],
        config: { width: 1080, height: 1920, fps: 30 },
      }
      const renderRes = await fetch("/api/ai/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!renderRes.ok) {
        const errData = await renderRes.json().catch(() => ({}))
        throw new Error(errData.error || `렌더 요청 실패: ${renderRes.status}`)
      }
      const result = await renderRes.json()
      const videoUrl = result.videoUrl
      const videoBase64 = result.videoBase64
      let serverBlob: Blob
      if (videoUrl) {
        const videoRes = await fetch(videoUrl)
        if (!videoRes.ok) throw new Error("렌더된 영상 다운로드 실패")
        serverBlob = await videoRes.blob()
      } else if (videoBase64) {
        const binary = atob(videoBase64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        serverBlob = new Blob([bytes], { type: "video/mp4" })
      } else {
        throw new Error("응답에 videoUrl 또는 videoBase64가 없습니다.")
      }
      await saveShotFormScheduleVideoBlob(item.id, serverBlob)

      // 기기로 파일 저장 (모바일: 공유/새 창, PC: 다운로드)
      const factoryFileName = `${item.productName}_공장_${item.id.slice(0, 8)}.mp4`
      const downloadUrl = URL.createObjectURL(serverBlob)
      const isMobileDevice = typeof navigator !== "undefined" && (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (typeof window !== "undefined" && window.innerWidth <= 768))
      if (isMobileDevice) {
        const file = new File([serverBlob], factoryFileName, { type: "video/mp4" })
        if (typeof navigator !== "undefined" && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: factoryFileName, text: "렌더링된 영상" })
          } catch (_) {
            window.open(downloadUrl, "_blank")
          }
        } else {
          window.open(downloadUrl, "_blank")
        }
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000)
      } else {
        const link = document.createElement("a")
        link.href = downloadUrl
        link.download = factoryFileName
        link.click()
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000)
      }

      // 유튜브 업로드용 제목·설명·태그 생성 (백그라운드에서는 항상 여기서 생성)
      let uploadTitle = item.youtubeTitle || item.productName
      let uploadDescription = item.youtubeDescription || ""
      let uploadTags: string[] = item.youtubeTags || []
      try {
        const meta = await generateYouTubeMetadata(
          item.productName,
          item.productDescription || "",
          script,
          openaiKey
        )
        uploadTitle = meta.title || uploadTitle
        uploadDescription = meta.description || uploadDescription
        uploadTags = meta.tags?.length ? meta.tags : uploadTags
      } catch (metaErr) {
        console.warn("[Factory] 유튜브 메타데이터 생성 실패, 제품명만 사용:", metaErr)
      }

      let youtubeUploaded = false
      const channelName = typeof window !== "undefined" ? localStorage.getItem("shopping_factory_youtube_channel") : null
      if (channelName) {
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const r = new FileReader()
            r.onload = () => { const s = r.result as string; resolve(s.includes(",") ? s.split(",")[1] : s) }
            r.onerror = reject
            r.readAsDataURL(serverBlob)
          })
          const [y, m, d] = item.scheduledDate.split("-").map(Number)
          const [h, min] = (item.scheduledTime || "09:00").split(":").map(Number)
          const scheduledDateTime = new Date(y, m - 1, d, h, min)
          const clientId = typeof window !== "undefined" ? localStorage.getItem("shopping_factory_youtube_client_id") : null
          const clientSecret = typeof window !== "undefined" ? localStorage.getItem("shopping_factory_youtube_client_secret") : null
          const uploadRes = await fetch("/api/youtube/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videoUrl: "blob:",
              videoBase64: base64,
              title: uploadTitle,
              description: uploadDescription,
              tags: uploadTags,
              scheduledTime: scheduledDateTime.toISOString(),
              clientId: clientId || undefined,
              clientSecret: clientSecret || undefined,
            }),
          })
          const uploadData = await uploadRes.json().catch(() => ({}))
          if (uploadRes.ok && uploadData.success) youtubeUploaded = true
        } catch (_) {}
      }
      setFactorySchedules((prev) => {
        const next = prev.map((s) =>
          s.id === item.id
            ? {
                ...s,
                status: "ready" as const,
                videoBlobId: item.id,
                youtubeTitle: uploadTitle,
                youtubeDescription: uploadDescription,
                youtubeTags: uploadTags,
                youtubeUploaded,
              }
            : s
        )
        localStorage.setItem(FACTORY_SCHEDULES_STORAGE_KEY, JSON.stringify(next))
        return next
      })

      URL.revokeObjectURL(ttsBlobUrl)
      updatePhase("preview", "ready")
    } catch (e) {
      console.error("[Factory] 백그라운드 파이프라인 실패:", e)
      setFactorySchedules((prev) => {
        const next = prev.map((s) =>
          s.id === item.id ? { ...s, status: "failed" as const, errorMessage: e instanceof Error ? e.message : String(e) } : s
        )
        localStorage.setItem(FACTORY_SCHEDULES_STORAGE_KEY, JSON.stringify(next))
        return next
      })
    }
  }

  // 공장 자동화 큐: 한 번에 하나씩만 백그라운드 파이프라인 실행 (순차 처리)
  useEffect(() => {
    if (factoryPipelineQueue.length === 0 || factoryPipelineRunningRef.current) return
    const first = factoryPipelineQueue[0]
    factoryPipelineRunningRef.current = true
    setFactoryPipelineRunningItemId(first.id)
    runFactoryPipelineInBackground(first).finally(() => {
      factoryPipelineRunningRef.current = false
      setFactoryPipelineRunningItemId(null)
      setFactoryPipelineQueue((prev) => prev.filter((s) => s.id !== first.id))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queue만 반응, pipeline 함수는 최신 클로저 사용
  }, [factoryPipelineQueue])

  useEffect(() => {
    if (!factoryAutoRunItem || factoryPipelineScriptStartedRef.current || activeStep !== "product") return
    if (!productName) return
    factoryPipelineScriptStartedRef.current = true
    handleGenerateScript()
  }, [factoryAutoRunItem, activeStep, productName])

  // 공장 자동화: 썸네일 준비되면 자동으로 미리보기 단계로 이동 (버튼 클릭 없이)
  useEffect(() => {
    if (!factoryAutoRunItem || activeStep !== "thumbnail") return
    const thumbReady = thumbnailUrl || thumbnailImages.length > 0
    if (!thumbReady || convertedVideoUrls.size !== 3 || !ttsAudioUrl) return
    setActiveStep("preview")
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 자동 진행용
  }, [factoryAutoRunItem?.id, activeStep, thumbnailUrl, thumbnailImages.length, convertedVideoUrls.size, ttsAudioUrl])

  // 공장 자동화: 미리보기 단계 진입 시 미리보기 생성 자동 실행 (한 번만)
  useEffect(() => {
    if (!factoryAutoRunItem) {
      factoryPreviewAutoTriggeredRef.current = null
      return
    }
    if (activeStep !== "preview" || previewGenerated || isGeneratingPreview) return
    if (convertedVideoUrls.size !== 3 || !ttsAudioUrl) return
    if (factoryPreviewAutoTriggeredRef.current === factoryAutoRunItem.id) return
    factoryPreviewAutoTriggeredRef.current = factoryAutoRunItem.id
    handleGeneratePreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref로 한 번만 호출
  }, [factoryAutoRunItem?.id, activeStep, previewGenerated, isGeneratingPreview, convertedVideoUrls.size, ttsAudioUrl])

  // 공장 자동화: 미리보기 생성 완료 시 서버 다운로드(렌더) 자동 시작 (한 번만)
  useEffect(() => {
    if (!factoryAutoRunItem) {
      factoryServerDownloadTriggeredRef.current = null
      return
    }
    if (activeStep !== "preview" || !previewGenerated || isServerDownloading) return
    if (factoryServerDownloadTriggeredRef.current === factoryAutoRunItem.id) return
    factoryServerDownloadTriggeredRef.current = factoryAutoRunItem.id
    handleServerDownload()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref 방지로 한 번만 호출
  }, [factoryAutoRunItem?.id, activeStep, previewGenerated, isServerDownloading])

  const handleDownload = () => {
    if (!videoUrl) return

    const mobile = isMobile()
    
    if (mobile) {
      // 모바일에서는 새 창에서 열기 또는 공유 기능 사용
      try {
        // iOS Safari에서는 다운로드가 제한되므로 새 창에서 열기
        const newWindow = window.open(videoUrl, "_blank")
        if (!newWindow) {
          // 팝업이 차단된 경우 사용자에게 알림
          alert("모바일에서는 영상을 새 창에서 열어 다운로드하거나 공유할 수 있습니다.\n\n영상 URL을 복사하여 사용하세요.")
          // URL 복사 기능 제공
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(videoUrl).then(() => {
              alert("영상 URL이 클립보드에 복사되었습니다.")
            }).catch(() => {
              // 복사 실패 시 URL 표시
              prompt("영상 URL (복사하세요):", videoUrl)
            })
          } else {
            prompt("영상 URL (복사하세요):", videoUrl)
          }
        }
      } catch (error) {
        console.error("다운로드 실패:", error)
        alert("모바일에서는 영상 다운로드가 제한될 수 있습니다.\n\n영상 URL을 복사하여 사용하세요.")
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(videoUrl).then(() => {
            alert("영상 URL이 클립보드에 복사되었습니다.")
          }).catch(() => {
            prompt("영상 URL (복사하세요):", videoUrl)
          })
        } else {
          prompt("영상 URL (복사하세요):", videoUrl)
        }
      }
    } else {
      // 데스크톱에서는 일반 다운로드
    const link = document.createElement("a")
    link.href = videoUrl
    link.download = `${productName}_shopping_video.mp4`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    }
  }

  const renderStepContent = () => {
    switch (activeStep) {
      case "product":
        return (
          <div className="space-y-6">
            <Card className="border border-orange-200/50 rounded-2xl shadow-2xl bg-white/80 backdrop-blur-xl overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-50/50 to-amber-50/30"></div>
              <CardHeader className="pb-4 relative z-10 border-b border-orange-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 border border-orange-200/50 shadow-sm">
                    <ShoppingBag className="w-5 h-5 text-orange-600" />
                  </div>
                  <CardTitle className="text-xl font-bold text-slate-800">
                    제품 정보
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 py-6 relative z-10">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="product-name" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      제품명 <span className="text-red-500">*</span>
                    </Label>
                  </div>
                  <p className="text-xs text-slate-500">예: 무선 블루투스 이어폰</p>
                  <Input
                    id="product-name"
                    placeholder="제품명을 입력해주세요"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="h-12 bg-white/80 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-orange-400 focus:ring-orange-400/20 shadow-sm"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="product-description" className="text-sm font-semibold text-slate-700">
                    제품 설명 (선택사항)
                  </Label>
                  <p className="text-xs text-slate-500">
                    제품의 주요 특징, 장점 등을 입력해주세요. 비워두면 제품명만으로 대본을 생성합니다.
                  </p>
                  <Textarea
                    id="product-description"
                    placeholder="제품 설명을 입력해주세요"
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    rows={4}
                    className="resize-none bg-white/80 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-orange-400 focus:ring-orange-400/20 shadow-sm"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="video-duration" className="text-sm font-semibold text-slate-700">
                    영상 길이
                  </Label>
                  <p className="text-xs text-slate-500">
                    영상 길이를 선택하세요. 선택한 길이에 맞춰 대본이 생성됩니다.
                  </p>
                  <Select value={videoDuration.toString()} onValueChange={(value) => setVideoDuration(parseInt(value) as 12 | 15 | 20 | 30)}>
                    <SelectTrigger className="h-12 bg-white/80 border-slate-200 text-slate-900 focus:border-orange-400 focus:ring-orange-400/20 shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 shadow-xl">
                      <SelectItem value="12" className="text-slate-900 hover:bg-orange-50">12초</SelectItem>
                      <SelectItem value="15" className="text-slate-900 hover:bg-orange-50">15초</SelectItem>
                      <SelectItem value="20" className="text-slate-900 hover:bg-orange-50">20초</SelectItem>
                      <SelectItem value="30" className="text-slate-900 hover:bg-orange-50">30초</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="product-image" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    제품 이미지 <span className="text-red-500">*</span>
                  </Label>
                  {!productImage ? (
                    <div
                      className={`border-dashed border-2 rounded-2xl p-8 md:p-12 text-center transition-all duration-300 ${
                        isDragging
                          ? "border-orange-400 bg-orange-50 backdrop-blur-sm scale-[1.02]"
                          : "border-orange-300 bg-orange-50/50 hover:border-orange-400 hover:bg-orange-50 backdrop-blur-sm"
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <input
                        type="file"
                        id="product-image"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="product-image"
                        className="cursor-pointer flex flex-col items-center gap-4"
                      >
                        <div className={`p-4 rounded-2xl ${isDragging ? "bg-orange-100" : "bg-orange-50"} transition-all shadow-sm`}>
                          <ImageIcon className={`w-12 h-12 ${isDragging ? "text-orange-500" : "text-orange-600"}`} />
                        </div>
                        <div className="space-y-2">
                          <span className={`text-sm md:text-base font-semibold block ${isDragging ? "text-orange-700" : "text-slate-700"}`}>
                            {isDragging ? "여기에 이미지를 놓아주세요" : "제품 이미지를 업로드해주세요"}
                          </span>
                          <span className="text-xs text-slate-500 block">
                            이미지를 클릭하거나 드래그하여 업로드
                          </span>
                          <span className="text-xs text-slate-400 block">
                            PNG, JPG, GIF (최대 10MB)
                          </span>
                        </div>
                      </label>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="relative w-full h-64 rounded-2xl overflow-hidden border-2 border-orange-200 bg-white backdrop-blur-sm shadow-xl">
                        <img
                          src={productImage}
                          alt="제품 이미지"
                          className="w-full h-full object-contain"
                        />
                        <button
                          onClick={handleRemoveImage}
                          className="absolute top-3 right-3 p-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-full hover:from-red-600 hover:to-red-700 transition-all shadow-lg hover:scale-110"
                          type="button"
                          aria-label="이미지 제거"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-3 text-center">
                        이미지가 업로드되었습니다. 다른 이미지를 업로드하려면 제거 후 다시 업로드하세요.
                      </p>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-red-400">
                      <X className="w-4 h-4" />
                      <span className="text-sm font-medium">{error}</span>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleGenerateScript}
                  disabled={!productName.trim() || !productImage || isGeneratingScript}
                  className="w-full h-14 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 hover:from-orange-400 hover:via-amber-400 hover:to-orange-400 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-orange-500/50 hover:shadow-xl hover:shadow-orange-500/50 transform hover:scale-[1.02]"
                  size="lg"
                >
                  {isGeneratingScript ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      AI가 대본을 생성하고 있습니다...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
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
            <div className="text-center space-y-3">
              <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                생성된 대본
              </h2>
              <p className="text-slate-600 text-base">대본을 확인하고 수정할 수 있습니다</p>
            </div>

            <Card className="border border-orange-200/50 rounded-2xl shadow-2xl bg-gradient-to-br from-orange-50/80 to-amber-50/60 backdrop-blur-xl overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-50/50 to-amber-50/30"></div>
              <CardHeader className="relative z-10 border-b border-orange-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 border border-orange-200/50 shadow-sm">
                      <FileText className="w-5 h-5 text-orange-600" />
                    </div>
                    <CardTitle className="text-xl font-bold text-slate-800">
                      대본 ({videoDuration}초)
                    </CardTitle>
                  </div>
                  <div className="flex gap-2">
                    {!isEditingScript ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsEditingScript(true)
                          setEditedScript(script)
                        }}
                        className="text-sm border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 hover:from-orange-100 hover:to-amber-100 hover:text-orange-800 hover:border-orange-400 font-semibold"
                      >
                        편집
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsEditingScript(false)
                            setEditedScript("")
                          }}
                          className="text-sm border-slate-300 bg-gradient-to-r from-slate-50 to-gray-50 text-slate-700 hover:from-slate-100 hover:to-gray-100 hover:text-slate-800 hover:border-slate-400 font-semibold"
                        >
                          취소
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleSaveEditedScript}
                          className="text-sm bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-semibold shadow-md"
                        >
                          저장
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateScript}
                      disabled={isGeneratingScript}
                      className="text-sm border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 hover:from-orange-100 hover:to-amber-100 hover:text-orange-800 hover:border-orange-400 font-semibold disabled:opacity-50"
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
                </div>
              </CardHeader>
              <CardContent className="space-y-4 relative z-10">
                {/* 전체 대본 표시 */}
                <div>
                  <Label className="text-sm font-semibold text-slate-700 mb-2 block">전체 대본</Label>
                  <Textarea
                    value={isEditingScript ? editedScript : script}
                    onChange={(e) => isEditingScript ? setEditedScript(e.target.value) : setScript(e.target.value)}
                    rows={8}
                    className="font-medium bg-gradient-to-br from-orange-50/90 to-amber-50/70 border-orange-200 text-slate-900 placeholder:text-slate-400 focus:border-orange-400 focus:ring-orange-400/20 resize-none shadow-sm"
                    placeholder="대본이 여기에 표시됩니다..."
                    disabled={!isEditingScript && !script}
                  />
                </div>
                
                {isAnalyzingScript && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>대본을 분석하고 있습니다...</span>
                  </div>
                )}
                
                {/* 대본 파트별 분석 결과 */}
                {script && scriptParts.length > 0 && !isEditingScript && (
                  <div className="space-y-3 pt-4 border-t border-orange-100">
                    <Label className="text-sm font-semibold text-slate-700 mb-3 block">대본 분석</Label>
                    <div className="space-y-3">
                      {scriptParts.map((part, index) => {
                        const partColors: Record<string, { bg: string; border: string; text: string; label: string }> = {
                          "인트로/후킹": { bg: "from-pink-50 to-rose-50", border: "border-pink-300", text: "text-pink-700", label: "인트로/후킹" },
                          "제품 소개": { bg: "from-blue-50 to-cyan-50", border: "border-blue-300", text: "text-blue-700", label: "제품 소개" },
                          "제품 장점": { bg: "from-green-50 to-emerald-50", border: "border-green-300", text: "text-green-700", label: "제품 장점" },
                          "마무리": { bg: "from-purple-50 to-indigo-50", border: "border-purple-300", text: "text-purple-700", label: "마무리" },
                        }
                        const colors = partColors[part.part] || { bg: "from-gray-50 to-slate-50", border: "border-gray-300", text: "text-gray-700", label: part.part }
                        
                        return (
                          <div
                            key={index}
                            className={`p-4 rounded-xl border-2 ${colors.border} bg-gradient-to-br ${colors.bg} backdrop-blur-sm shadow-sm`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`px-2 py-1 text-xs font-bold rounded-full ${colors.text} bg-white/80 border ${colors.border}`}>
                                {colors.label}
                              </span>
                              <span className="text-xs text-slate-500">
                                {part.text.length}자
                              </span>
                            </div>
                            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                              {part.text}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-red-600">
                      <X className="w-4 h-4" />
                      <span className="text-sm font-medium">{error}</span>
                    </div>
                  </div>
                )}

                {/* TTS 생성 */}
                <Card className="border border-blue-200/50 rounded-xl bg-white/60 backdrop-blur-sm shadow-lg mt-6">
                  <CardContent className="p-5 space-y-4">
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">TTS 생성</h3>
                      <p className="text-sm text-slate-600 mt-1">대본을 음성으로 변환합니다</p>
                    </div>

                    {/* 목소리 선택 UI */}
                    <div className="space-y-4 pt-4 border-t border-blue-100">
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-slate-700">목소리 선택</Label>
                        
                        {/* 수퍼톤 선택 */}
                        <div className="space-y-3 p-4 border border-blue-200/50 rounded-xl bg-white/60 backdrop-blur-sm shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div
                                className={`w-4 h-4 rounded-full border-2 cursor-pointer ${
                                  selectedVoiceId?.startsWith("supertone-") ? "border-purple-500 bg-purple-500" : "border-gray-300"
                                }`}
                                onClick={() => {
                                  if (supertoneVoices.length > 0 && !selectedSupertoneVoiceId) {
                                    setSelectedSupertoneVoiceId(supertoneVoices[0].voice_id)
                                    setSelectedVoiceId(`supertone-${supertoneVoices[0].voice_id}`)
                                    const firstVoice = supertoneVoices[0]
                                    if (firstVoice.styles && firstVoice.styles.length > 0) {
                                      const neutralStyle = firstVoice.styles.find(s => s.toLowerCase().includes("neutral") || s === "중립")
                                      setSelectedSupertoneStyle(neutralStyle || firstVoice.styles[0])
                                    }
                                  } else if (selectedSupertoneVoiceId) {
                                    setSelectedSupertoneVoiceId("")
                                    setSelectedVoiceId("ttsmaker-여성1")
                                  } else {
                                    fetchSupertoneVoices()
                                  }
                                }}
                              >
                                {selectedVoiceId?.startsWith("supertone-") && (
                                  <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                                )}
                              </div>
                              <p className={`text-sm font-medium ${selectedVoiceId?.startsWith("supertone-") ? "text-purple-900" : "text-gray-700"}`}>수퍼톤 (SuperTone)</p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={fetchSupertoneVoices}
                              disabled={isLoadingSupertoneVoices}
                              className={selectedVoiceId?.startsWith("supertone-") ? "border-purple-300 text-purple-700" : ""}
                            >
                              {isLoadingSupertoneVoices ? (
                                <>
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  로딩 중...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="w-3 h-3 mr-1" />
                                  음성 목록 가져오기
                                </>
                              )}
                            </Button>
                          </div>
                          
                          {supertoneVoices.length > 0 && (
                            <div className="mt-3">
                              <Label className="text-sm font-medium text-gray-700 mb-2 block">음성 목록에서 선택</Label>
                              <Select
                                value={selectedSupertoneVoiceId && supertoneVoices.find(v => v.voice_id === selectedSupertoneVoiceId) ? selectedSupertoneVoiceId : ""}
                                onValueChange={(value) => {
                                  setSelectedSupertoneVoiceId(value)
                                  setSelectedVoiceId(`supertone-${value}`)
                                  const selectedVoice = supertoneVoices.find(v => v.voice_id === value)
                                  if (selectedVoice && selectedVoice.styles && selectedVoice.styles.length > 0) {
                                    const neutralStyle = selectedVoice.styles.find(s => s.toLowerCase().includes("neutral") || s === "중립")
                                    setSelectedSupertoneStyle(neutralStyle || selectedVoice.styles[0])
                                  } else {
                                    setSelectedSupertoneStyle("neutral")
                                  }
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="수퍼톤 음성을 선택하세요" />
                                </SelectTrigger>
                                <SelectContent>
                                  {supertoneVoices.map((voice) => (
                                    <SelectItem key={voice.voice_id} value={voice.voice_id}>
                                      <div className="flex items-center gap-2">
                                        {voice.thumbnail_image_url && (
                                          <img
                                            src={voice.thumbnail_image_url}
                                            alt={voice.name}
                                            className="w-6 h-6 rounded-full object-cover"
                                          />
                                        )}
                                        <div>
                                          <div className="font-medium">{voice.name}</div>
                                          <div className="text-xs text-gray-500">ID: {voice.voice_id}</div>
                                          {voice.styles && voice.styles.length > 0 && (
                                            <div className="text-xs text-gray-500">
                                              스타일: {voice.styles.join(", ")}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          {selectedSupertoneVoiceId && (() => {
                            const selectedVoice = supertoneVoices.find(v => v.voice_id === selectedSupertoneVoiceId)
                            const availableStyles = selectedVoice?.styles || []
                            // 직접 입력한 ID인 경우 스타일 선택 표시하지 않음 (기본 neutral 사용)
                            if (!selectedVoice) {
                              return null
                            }
                            return availableStyles.length > 0 && (
                              <div className="mt-2">
                                <p className="text-sm font-medium text-gray-700 mb-2">스타일 선택</p>
                                <Select
                                  value={selectedSupertoneStyle}
                                  onValueChange={setSelectedSupertoneStyle}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="스타일을 선택하세요" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableStyles.map((style) => (
                                      <SelectItem key={style} value={style}>
                                        {style}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )
                          })()}
                          
                          {/* 수퍼톤 ID 직접 입력 */}
                          <div className="mt-3 space-y-2">
                            <Label className="text-sm font-medium text-gray-700">또는 ID 직접 입력</Label>
                            <Input
                              placeholder="수퍼톤 Voice ID를 입력하세요"
                              value={selectedSupertoneVoiceId && !supertoneVoices.find(v => v.voice_id === selectedSupertoneVoiceId) ? selectedSupertoneVoiceId : ""}
                              onChange={(e) => {
                                const inputId = e.target.value.trim()
                                if (inputId) {
                                  // 직접 입력한 ID를 우선적으로 선택
                                  setSelectedSupertoneVoiceId(inputId)
                                  setSelectedVoiceId(`supertone-${inputId}`)
                                  setSelectedSupertoneStyle("neutral") // 기본 스타일
                                } else {
                                  setSelectedSupertoneVoiceId("")
                                  if (selectedVoiceId?.startsWith("supertone-")) {
                                    setSelectedVoiceId("ttsmaker-여성1")
                                  }
                                }
                              }}
                              className="w-full border-purple-200 focus:border-purple-400 focus:ring-purple-400/20"
                            />
                            <p className="text-xs text-gray-500">수퍼톤 Voice ID를 알고 있다면 직접 입력할 수 있습니다. 직접 입력한 ID가 우선적으로 적용됩니다.</p>
                          </div>
                          {selectedSupertoneVoiceId && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full mt-2 border-purple-300 text-purple-700 hover:bg-purple-100"
                              onClick={() => handlePreviewVoice(`supertone-${selectedSupertoneVoiceId}`)}
                              disabled={previewingVoiceId === `supertone-${selectedSupertoneVoiceId}`}
                            >
                              {previewingVoiceId === `supertone-${selectedSupertoneVoiceId}` ? (
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
                          )}
                        </div>

                        {/* ElevenLabs 음성 선택 */}
                        <div className="space-y-3 p-4 border border-blue-200/50 rounded-xl bg-white/60 backdrop-blur-sm shadow-sm mt-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div
                                className={`w-4 h-4 rounded-full border-2 cursor-pointer ${
                                  selectedVoiceId?.startsWith("elevenlabs-") ? "border-blue-500 bg-blue-500" : "border-gray-300"
                                }`}
                                onClick={() => {
                                  if (selectedVoiceId?.startsWith("elevenlabs-")) {
                                    setSelectedVoiceId("ttsmaker-여성1")
                                    setCustomElevenLabsVoiceId("")
                                  } else {
                                    if (customElevenLabsVoiceId) {
                                      setSelectedVoiceId(`elevenlabs-${customElevenLabsVoiceId}`)
                                    } else {
                                      setSelectedVoiceId("elevenlabs-jB1Cifc2UQbq1gR3wnb0")
                                    }
                                    // 다른 TTS 선택 시 수퍼톤 선택 해제
                                    if (selectedSupertoneVoiceId) {
                                      setSelectedSupertoneVoiceId("")
                                    }
                                  }
                                }}
                              >
                                {selectedVoiceId?.startsWith("elevenlabs-") && (
                                  <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                                )}
                              </div>
                              <p className={`text-sm font-medium ${selectedVoiceId?.startsWith("elevenlabs-") ? "text-blue-900" : "text-gray-700"}`}>ElevenLabs</p>
                            </div>
                          </div>
                          <div className="mt-3 space-y-2">
                            <Label className="text-sm font-medium text-gray-700">Voice ID 직접 입력</Label>
                            <Input
                              type="text"
                              placeholder="ElevenLabs 음성 ID 입력 (예: jB1Cifc2UQbq1gR3wnb0)"
                              value={customElevenLabsVoiceId}
                              onChange={(e) => {
                                const voiceId = e.target.value.trim()
                                setCustomElevenLabsVoiceId(voiceId)
                                if (voiceId && selectedVoiceId?.startsWith("elevenlabs-")) {
                                  setSelectedVoiceId(`elevenlabs-${voiceId}`)
                                } else if (voiceId) {
                                  setSelectedVoiceId(`elevenlabs-${voiceId}`)
                                  // 다른 TTS 선택 시 수퍼톤 선택 해제
                                  if (selectedSupertoneVoiceId) {
                                    setSelectedSupertoneVoiceId("")
                                  }
                                }
                              }}
                              className="w-full border-blue-200 focus:border-blue-400 focus:ring-blue-400/20"
                            />
                            <div className="mt-2">
                              <p className="text-xs text-gray-500 mb-2">추천 음성:</p>
                              <div className="flex gap-2 flex-wrap">
                                {[
                                  { id: "jB1Cifc2UQbq1gR3wnb0", name: "Rachel" },
                                  { id: "8jHHF8rMqMlg8if2mOUe", name: "Voice 2" },
                                  { id: "uyVNoMrnUku1dZyVEXwD", name: "Voice 3" },
                                  { id: "1KNqBv4TutQtzSIACsMC", name: "Voice 4" },
                                  { id: "4JJwo477JUAx3HV0T7n7", name: "Voice 5" },
                                ].map((voice) => (
                                  <Button
                                    key={voice.id}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setCustomElevenLabsVoiceId(voice.id)
                                      setSelectedVoiceId(`elevenlabs-${voice.id}`)
                                      // 다른 TTS 선택 시 수퍼톤 선택 해제
                                      if (selectedSupertoneVoiceId) {
                                        setSelectedSupertoneVoiceId("")
                                      }
                                    }}
                                    className={selectedVoiceId === `elevenlabs-${voice.id}` ? "bg-blue-100 border-blue-500" : ""}
                                  >
                                    {voice.name}
                                  </Button>
                                ))}
                              </div>
                            </div>
                            {selectedVoiceId?.startsWith("elevenlabs-") && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full mt-2 border-blue-300 text-blue-700 hover:bg-blue-100"
                                onClick={() => handlePreviewVoice(selectedVoiceId)}
                                disabled={previewingVoiceId === selectedVoiceId}
                              >
                                {previewingVoiceId === selectedVoiceId ? (
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
                            )}
                          </div>
                        </div>

                        {/* TTSMaker 목소리 선택 */}
                        <div className="space-y-2 mt-4">
                          <Label className="text-sm font-semibold text-slate-700">TTSMaker 목소리 선택</Label>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                                className={`p-3 border-2 rounded-lg transition-all cursor-pointer ${
                                  selectedVoiceId === voice.id
                                    ? "border-red-500 bg-red-50"
                                    : "border-gray-200 hover:border-gray-300"
                                }`}
                              >
                                <div className="flex items-center space-x-2 mb-2">
                                  <div
                                    className={`w-4 h-4 rounded-full border-2 cursor-pointer ${
                                      selectedVoiceId === voice.id ? "border-red-500 bg-red-500" : "border-gray-300"
                                    }`}
                                    onClick={() => {
                                      setSelectedVoiceId(voice.id)
                                      if (selectedSupertoneVoiceId) {
                                        setSelectedSupertoneVoiceId("")
                                      }
                                      if (customElevenLabsVoiceId) {
                                        setCustomElevenLabsVoiceId("")
                                      }
                                    }}
                                  >
                                    {selectedVoiceId === voice.id && (
                                      <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                                    )}
                                  </div>
                                  <div 
                                    className="flex-1 cursor-pointer"
                                    onClick={() => {
                                      setSelectedVoiceId(voice.id)
                                      if (selectedSupertoneVoiceId) {
                                        setSelectedSupertoneVoiceId("")
                                      }
                                      if (customElevenLabsVoiceId) {
                                        setCustomElevenLabsVoiceId("")
                                      }
                                    }}
                                  >
                                    <p className="text-sm font-medium">{voice.name}</p>
                                    {voice.note && <p className="text-xs text-gray-500">{voice.note}</p>}
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full text-xs"
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
                        </div>
                      </div>
                    </div>
                    {ttsProgress.total > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-slate-600">
                          <span>진행 상황</span>
                          <span>{ttsProgress.current} / {ttsProgress.total}</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
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
                        <p className="text-xs text-slate-400 mt-2">위 플레이어에서 생성된 음성을 확인할 수 있습니다.</p>
                      </div>
                    ) : (
                      <div className="mt-3 p-4 bg-white/60 border border-slate-200 rounded-xl text-center">
                        <p className="text-sm text-slate-600">TTS 생성 후 미리듣기가 가능합니다.</p>
                      </div>
                    )}
                    
                    {/* TTS 생성/재생성 버튼 (하단) */}
                    <div className="pt-4 border-t border-blue-100 space-y-2">
                      <Button
                        onClick={handleGenerateTTS}
                        disabled={isGeneratingTTS}
                        className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400 text-white font-semibold shadow-lg shadow-blue-500/50"
                        size="lg"
                      >
                        {isGeneratingTTS ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            TTS 생성 중...
                          </>
                        ) : ttsAudioUrl ? (
                          <>
                            <RefreshCw className="w-5 h-5 mr-2" />
                            TTS 재생성
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5 mr-2" />
                            TTS 생성하기
                          </>
                        )}
                      </Button>
                      {ttsAudioUrl && (
                        <p className="text-xs text-center text-slate-500">
                          기존 음성 파일이 있어도 재생성할 수 있습니다.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setActiveStep("product")}
                    className="flex-1 border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 hover:from-orange-100 hover:to-amber-100 hover:text-orange-800 hover:border-orange-400 font-semibold shadow-md transition-all"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    이전
                  </Button>
                  <Button
                    onClick={handleGoToImageGeneration}
                    disabled={!script.trim()}
                    className="flex-1 bg-gradient-to-r from-green-500 via-emerald-500 to-green-500 hover:from-green-400 hover:via-emerald-400 hover:to-green-400 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/50 hover:shadow-xl hover:shadow-green-500/50 transition-all duration-300"
                    size="lg"
                  >
                    <ImageIcon className="w-5 h-5 mr-2" />
                    이미지 생성하기
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case "video":
        return (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                이미지 생성
              </h2>
              <p className="text-slate-600 text-base">AI가 이미지를 생성합니다</p>
            </div>

            {isGeneratingVideo ? (
              /* 이미지 생성 애니메이션: 원본 이미지가 생성된 이미지로 변환 */
              productImage ? (
                <Card className="border border-green-200/50 rounded-2xl shadow-2xl bg-white/80 backdrop-blur-xl overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 to-emerald-50/30"></div>
                  <CardHeader className="relative z-10 border-b border-green-100">
                    <CardTitle className="text-xl font-bold text-slate-800">이미지 생성 중...</CardTitle>
                  </CardHeader>
                  <CardContent className="py-6 relative z-10">
                    <div className="flex items-center justify-center gap-8 flex-wrap">
                      {/* 원본 이미지 */}
                      <div className="space-y-3 text-center">
                        <Label className="text-sm font-semibold text-slate-700">원본 이미지</Label>
                        <div className="relative w-48 aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-blue-300 shadow-lg">
                          <img
                            src={productImage}
                            alt="원본 제품 이미지"
                            className={`w-full h-full opacity-70 transition-opacity duration-1000 ${
                              productImageAspectRatio !== null && Math.abs(productImageAspectRatio - 1) < 0.1
                                ? "object-contain" // 1:1 비율일 때는 축소해서 전체 표시 (상하 여백 생김)
                                : "object-cover" // 그 외에는 기존대로
                            }`}
                          />
                        </div>
                      </div>

                      {/* AI 변환 애니메이션 */}
                      <div className="flex flex-col items-center justify-center relative">
                        {/* 화살표 */}
                        <div className="relative">
                          <ArrowRight className="w-16 h-16 text-green-500 animate-pulse" />
                          {/* AI 생성 효과 - Sparkles */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <Sparkles className="w-8 h-8 text-green-400 animate-bounce absolute -top-2 -left-2" style={{ animationDelay: '0s' }} />
                            <Sparkles className="w-6 h-6 text-emerald-400 animate-bounce absolute -top-1 -right-1" style={{ animationDelay: '0.2s' }} />
                            <Sparkles className="w-5 h-5 text-green-300 animate-bounce absolute -bottom-1 -left-1" style={{ animationDelay: '0.4s' }} />
                            <Sparkles className="w-7 h-7 text-emerald-300 animate-bounce absolute -bottom-2 -right-2" style={{ animationDelay: '0.6s' }} />
                          </div>
                          {/* 회전하는 로딩 링 */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                          {/* Bot 아이콘 */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Bot className="w-6 h-6 text-green-600 animate-pulse" />
                          </div>
                        </div>
                        <span className="text-xs text-slate-500 mt-3 font-medium">AI가 이미지를 생성 중...</span>
                      </div>

                      {/* 생성 중인 이미지 */}
                      <div className="space-y-3 text-center">
                        <Label className="text-sm font-semibold text-slate-700">생성 중...</Label>
                        <div className="relative w-48 aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-green-500 shadow-lg">
                          {/* 그라데이션 배경 애니메이션 */}
                          <div className="absolute inset-0 bg-gradient-to-br from-green-200/50 via-emerald-200/50 to-green-300/50 animate-pulse"></div>
                          {/* 파티클 효과 */}
                          <div className="absolute inset-0">
                            <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-green-400 rounded-full animate-ping" style={{ animationDelay: '0s' }}></div>
                            <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-emerald-400 rounded-full animate-ping" style={{ animationDelay: '0.3s' }}></div>
                            <div className="absolute bottom-1/4 left-1/2 w-2 h-2 bg-green-300 rounded-full animate-ping" style={{ animationDelay: '0.6s' }}></div>
                            <div className="absolute bottom-1/3 right-1/3 w-2 h-2 bg-emerald-300 rounded-full animate-ping" style={{ animationDelay: '0.9s' }}></div>
                          </div>
                          {/* 중앙 로딩 스피너 */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="relative">
                              <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
                              <Sparkles className="w-4 h-4 text-green-400 absolute -top-1 -right-1 animate-bounce" />
                            </div>
                          </div>
                          {/* 하단 텍스트 */}
                          <div className="absolute bottom-2 left-2 right-2 text-[10px] text-green-600 font-medium bg-white/90 px-2 py-1 rounded text-center">
                            AI 생성 중...
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center space-y-4">
                      <Loader2 className="w-12 h-12 animate-spin mx-auto text-orange-500" />
                      <div>
                        <h3 className="text-xl font-semibold mb-2">이미지 생성 중...</h3>
                        <p className="text-muted-foreground mb-4">
                          AI가 이미지를 생성하고 있습니다
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            ) : imageUrls.length > 0 && productImage ? (
              /* 생성 완료: 원본 이미지와 생성된 3장의 이미지 */
              <Card className="border border-green-200/50 rounded-2xl shadow-2xl bg-white/80 backdrop-blur-xl overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 to-emerald-50/30"></div>
                <CardHeader className="relative z-10 border-b border-green-100">
                  <CardTitle className="text-xl font-bold text-slate-800">이미지 생성 완료 (1장)</CardTitle>
                </CardHeader>
                <CardContent className="py-6 relative z-10">
                  <div className="space-y-6">
                    {/* 원본 이미지와 생성된 이미지 좌우 배치 */}
                    <div className="flex items-center justify-center gap-8 flex-wrap">
                      {/* 원본 이미지 */}
                      <div className="space-y-3 text-center">
                        <Label className="text-sm font-semibold text-slate-700">원본 이미지</Label>
                        <div className="relative w-48 aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-blue-300 shadow-lg">
                          <img
                            src={productImage}
                            alt="원본 제품 이미지"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>

                      {/* 화살표 */}
                      <div className="flex flex-col items-center justify-center">
                        <ArrowRight className="w-16 h-16 text-green-500" />
                        <span className="text-xs text-slate-500 mt-2 font-medium">AI 변환</span>
                      </div>

                      {/* 생성된 이미지 (3개) */}
                      <div className="space-y-3 text-center">
                        <Label className="text-sm font-semibold text-slate-700">생성된 이미지 (3개)</Label>
                        <div className="flex gap-4 justify-center flex-wrap">
                          {imageUrls.map((url, index) => (
                            <div key={index} className="space-y-2">
                              <div className="flex items-center justify-center gap-2">
                                <Label className="text-xs font-medium text-slate-600">
                                  {imagePrompts[index]?.type || `이미지 ${index + 1}`}
                                </Label>
                                <Button
                                  onClick={() => handleRegenerateSingleImage(index as 0 | 1 | 2)}
                                  disabled={isRegeneratingImage.get(index)}
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-[10px] border-blue-300 bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 hover:from-blue-100 hover:to-cyan-100 hover:text-blue-800 hover:border-blue-400"
                                >
                                  {isRegeneratingImage.get(index) ? (
                                    <>
                                      <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />
                                      재생성 중
                                    </>
                                  ) : (
                                    <>
                                      <RefreshCw className="w-2.5 h-2.5 mr-1" />
                                      재생성
                                    </>
                                  )}
                                </Button>
                              </div>
                              {/* 추가 프롬프트 입력 필드 */}
                              <div className="space-y-1 w-48">
                                <Label className="text-[10px] text-slate-600">추가 프롬프트</Label>
                                <Input
                                  type="text"
                                  placeholder="예: 밝은 조명, 자연스러운 배경"
                                  value={customImagePrompts.get(index) || ""}
                                  onChange={(e) => {
                                    const newMap = new Map(customImagePrompts)
                                    newMap.set(index, e.target.value)
                                    setCustomImagePrompts(newMap)
                                  }}
                                  className="h-7 text-[10px]"
                                />
                              </div>
                              <div className="relative w-48 aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-green-500 shadow-lg">
                                {isRegeneratingImage.get(index) ? (
                                  <>
                                    <img
                                      src={url}
                                      alt={`생성된 이미지 ${index + 1}`}
                                      className="w-full h-full object-cover opacity-50"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-200/50 via-cyan-200/50 to-blue-300/50">
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="relative">
                                          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                                          <Sparkles className="w-3 h-3 text-blue-400 absolute -top-0.5 -right-0.5 animate-bounce" />
                                        </div>
                                      </div>
                                      <div className="absolute bottom-2 left-2 right-2 text-[9px] text-blue-600 font-medium bg-white/90 px-1.5 py-0.5 rounded text-center">
                                        재생성 중...
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <img
                                    src={url}
                                    alt={`생성된 이미지 ${index + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                                <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                                  {index + 1}
                                </div>
                                <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs font-medium px-2 py-1 rounded">
                                  {imagePrompts[index]?.type || `이미지 ${index + 1}`}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 이미지 프롬프트 표시 (Collapsible) */}
                    {imagePrompts.length > 0 && (
                      <div className="pt-4 border-t border-green-200">
                        <Collapsible>
                          <CollapsibleTrigger className="w-full group">
                            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all">
                              <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-blue-600" />
                                <span className="text-sm font-semibold text-blue-700">이미지 프롬프트 보기</span>
                              </div>
                              <ChevronDown className="w-5 h-5 text-blue-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="mt-3 space-y-3">
                              {imagePrompts.map((prompt, index) => (
                                <div key={index} className="p-4 bg-white rounded-lg border border-blue-200 shadow-sm">
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className="px-3 py-1 text-xs font-bold bg-blue-100 text-blue-700 rounded-full">
                                      {index + 1}. {prompt.type}
                                    </span>
                                  </div>
                                  <div className="space-y-2">
                                    <div>
                                      <p className="text-xs font-medium text-slate-700 mb-1">대본 부분:</p>
                                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
                                        {prompt.scriptText}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-slate-700 mb-1">프롬프트:</p>
                                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 font-mono break-words">
                                        {prompt.prompt}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-slate-700 mb-1">설명:</p>
                                      <p className="text-xs text-slate-500 italic">
                                        {prompt.description}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 pt-6 justify-center flex-wrap">
                    <Button
                      variant="outline"
                      onClick={() => setActiveStep("script")}
                      className="border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 hover:from-orange-100 hover:to-amber-100 hover:text-orange-800 hover:border-orange-400 font-semibold shadow-md transition-all"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      이전
                    </Button>
                    <Button
                      onClick={handleGenerateImage}
                      disabled={isGeneratingVideo}
                      variant="outline"
                      className="border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 hover:from-green-100 hover:to-emerald-100 hover:text-green-800 hover:border-green-400 font-semibold shadow-md transition-all"
                    >
                      {isGeneratingVideo ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          재생성 중...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          재생성
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => setActiveStep("render")}
                      className="bg-gradient-to-r from-green-500 via-emerald-500 to-green-500 hover:from-green-400 hover:via-emerald-400 hover:to-green-400 text-white font-bold shadow-lg shadow-green-500/50 hover:shadow-xl hover:shadow-green-500/50 transition-all duration-300"
                      size="lg"
                    >
                      다음 단계로
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* 이미지 생성 시작 화면 */
              <Card className="border border-green-200/50 rounded-2xl shadow-2xl bg-white/80 backdrop-blur-xl overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 to-emerald-50/30"></div>
                <CardHeader className="relative z-10 border-b border-green-100">
                  <CardTitle className="text-xl font-bold text-slate-800">이미지 생성 준비</CardTitle>
                </CardHeader>
                <CardContent className="py-6 relative z-10">
                  {productImage ? (
                    <div className="space-y-6">
                      <div className="text-center">
                        <p className="text-slate-600 mb-4">업로드된 제품 이미지를 기반으로 AI가 새로운 이미지를 생성합니다.</p>
                        <div className="flex justify-center mb-6">
                          <div className="relative w-48 aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-green-300 shadow-lg">
                            <img
                              src={productImage}
                              alt="제품 이미지"
                              className={`w-full h-full ${
                                productImageAspectRatio !== null && Math.abs(productImageAspectRatio - 1) < 0.1
                                  ? "object-contain" // 1:1 비율일 때는 축소해서 전체 표시 (상하 여백 생김)
                                  : "object-cover" // 그 외에는 기존대로
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* 프롬프트 생성 단계 */}
                      {!promptsGenerated ? (
                        <div className="space-y-4">
                          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                            <p className="text-sm text-blue-700 mb-3">
                              <strong>1단계:</strong> 대본을 분석하여 이미지 프롬프트를 생성합니다.
                            </p>
                            <Button
                              onClick={handleGenerateImagePrompts}
                              disabled={isGeneratingPrompts}
                              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-semibold shadow-lg shadow-blue-500/50"
                              size="lg"
                            >
                              {isGeneratingPrompts ? (
                                <>
                                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                  프롬프트 생성 중...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-5 h-5 mr-2" />
                                  이미지 프롬프트 생성하기
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* 생성된 프롬프트 표시 */}
                          <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                            <div className="flex items-center gap-2 mb-3">
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                              <p className="text-sm font-semibold text-green-700">프롬프트 생성 완료 (3개)</p>
                            </div>
                            <div className="space-y-3">
                              {imagePrompts.map((prompt, index) => (
                                <div key={index} className="p-4 bg-white rounded-lg border border-green-200 shadow-sm">
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className="px-3 py-1 text-xs font-bold bg-green-100 text-green-700 rounded-full">
                                      {index + 1}. {prompt.type}
                                    </span>
                                  </div>
                                  <div className="space-y-2">
                                    <div>
                                      <p className="text-xs font-medium text-slate-700 mb-1">대본 부분:</p>
                                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
                                        {prompt.scriptText}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-slate-700 mb-1">프롬프트:</p>
                                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 font-mono break-words">
                                        {prompt.prompt}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-slate-700 mb-1">설명:</p>
                                      <p className="text-xs text-slate-500 italic">
                                        {prompt.description}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* 이미지 생성 버튼 */}
                          <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                            <p className="text-sm text-purple-700 mb-3">
                              <strong>2단계:</strong> 생성된 프롬프트를 사용하여 이미지를 생성합니다.
                            </p>
                            <Button
                              onClick={handleGenerateImage}
                              disabled={isGeneratingVideo}
                              className="w-full bg-gradient-to-r from-green-500 via-emerald-500 to-green-500 hover:from-green-400 hover:via-emerald-400 hover:to-green-400 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/50 hover:shadow-xl hover:shadow-green-500/50 transition-all duration-300"
                              size="lg"
                            >
                              {isGeneratingVideo ? (
                                <>
                                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                  이미지 생성 중...
                                </>
                              ) : (
                                <>
                                  <ImageIcon className="w-5 h-5 mr-2" />
                                  이미지 생성하기
                                </>
                              )}
                            </Button>
                          </div>

                          {/* 프롬프트 재생성 버튼 */}
                          <Button
                            onClick={() => {
                              setPromptsGenerated(false)
                              setImagePrompts([])
                            }}
                            variant="outline"
                            size="sm"
                            className="w-full border-blue-300 bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 hover:from-blue-100 hover:to-cyan-100 hover:text-blue-800 hover:border-blue-400"
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            프롬프트 다시 생성하기
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-slate-600 mb-4">제품 이미지가 필요합니다.</p>
                      <Button
                        onClick={() => setActiveStep("product")}
                        variant="outline"
                        className="border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 hover:from-green-100 hover:to-emerald-100 hover:text-green-800 hover:border-green-400 font-semibold shadow-md"
                      >
                        제품 정보로 돌아가기
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )

      case "preview":
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">미리보기</h2>
              <p className="text-muted-foreground">영상을 미리보고 다운로드하세요</p>
            </div>

            {/* 좌우 레이아웃: 좌측 옵션, 우측 미리보기 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 좌측: 옵션 패널 */}
              <div className="lg:col-span-1 space-y-4">
                <div className="sticky top-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">옵션</h3>
                  
                  {/* 자막 스타일 설정 */}
                  <Collapsible>
                    <CollapsibleTrigger className="w-full group">
                      <Card className="border border-green-200/50 rounded-xl shadow-sm bg-white/80 hover:bg-white transition-all">
                        <CardHeader className="py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-green-600" />
                              <CardTitle className="text-base font-semibold text-slate-800">자막 스타일 설정</CardTitle>
                            </div>
                            <ChevronDown className="w-5 h-5 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                          </div>
                        </CardHeader>
                      </Card>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Card className="border border-green-200/50 rounded-xl shadow-sm bg-white/80 mt-2">
                        <CardContent className="space-y-5 py-6">
                          <div className="grid grid-cols-1 gap-5">
                            <div className="space-y-3">
                              <Label className="text-sm font-semibold text-slate-700">폰트 크기</Label>
                              <div className="flex items-center gap-3">
                                <Slider
                                  value={[subtitleStyle.fontSize]}
                                  onValueChange={([value]) => setSubtitleStyle({ ...subtitleStyle, fontSize: value })}
                                  min={24}
                                  max={72}
                                  step={4}
                                  className="flex-1"
                                />
                                <span className="text-sm text-slate-500 font-medium w-14 text-right">{subtitleStyle.fontSize}px</span>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <Label className="text-sm font-semibold text-slate-700">위치</Label>
                              <Select
                                value={subtitleStyle.position}
                                onValueChange={(value: "top" | "center" | "bottom") => setSubtitleStyle({ ...subtitleStyle, position: value })}
                              >
                                <SelectTrigger className="bg-white/80 border-slate-200 text-slate-900 focus:border-green-400 focus:ring-green-400/20 shadow-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-slate-200 shadow-xl">
                                  <SelectItem value="top" className="text-slate-900 hover:bg-green-50">상단</SelectItem>
                                  <SelectItem value="center" className="text-slate-900 hover:bg-green-50">중앙</SelectItem>
                                  <SelectItem value="bottom" className="text-slate-900 hover:bg-green-50">하단</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-3">
                              <Label className="text-sm font-semibold text-slate-700">위치 세부 조정 (Y축 오프셋)</Label>
                              <div className="flex items-center gap-3">
                                <Slider
                                  value={[subtitleStyle.positionOffset]}
                                  onValueChange={([value]) => setSubtitleStyle({ ...subtitleStyle, positionOffset: value })}
                                  min={-200}
                                  max={200}
                                  step={5}
                                  className="flex-1"
                                />
                                <span className="text-sm text-slate-500 font-medium w-20 text-right">
                                  {subtitleStyle.positionOffset > 0 ? `+${subtitleStyle.positionOffset}` : subtitleStyle.positionOffset}px
                                </span>
                              </div>
                              <p className="text-xs text-slate-500">
                                기본 위치에서 위(+)/아래(-)로 이동할 수 있습니다. 양수는 아래로, 음수는 위로 이동합니다.
                              </p>
                            </div>
                            <div className="space-y-3">
                              <Label className="text-sm font-semibold text-slate-700">텍스트 색상</Label>
                              <div className="flex gap-3">
                                <input
                                  type="color"
                                  value={subtitleStyle.color}
                                  onChange={(e) => setSubtitleStyle({ ...subtitleStyle, color: e.target.value })}
                                  className="w-14 h-12 rounded-lg border-2 border-slate-200 cursor-pointer shadow-sm"
                                />
                                <Input
                                  value={subtitleStyle.color}
                                  onChange={(e) => setSubtitleStyle({ ...subtitleStyle, color: e.target.value })}
                                  className="flex-1 bg-white/80 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-green-400 focus:ring-green-400/20 shadow-sm"
                                  placeholder="#FFFFFF"
                                />
                              </div>
                            </div>
                            <div className="space-y-3">
                              <Label className="text-sm font-semibold text-slate-700">배경 투명도</Label>
                              <div className="flex items-center gap-3">
                                <Slider
                                  value={[parseFloat(subtitleStyle.backgroundColor.split(",")[3]?.replace(")", "") || "0.5")]}
                                  onValueChange={([value]) => setSubtitleStyle({ ...subtitleStyle, backgroundColor: `rgba(0, 0, 0, ${value})` })}
                                  min={0}
                                  max={1}
                                  step={0.1}
                                  className="flex-1"
                                />
                                <span className="text-sm text-slate-500 font-medium w-14 text-right">
                                  {Math.round(parseFloat(subtitleStyle.backgroundColor.split(",")[3]?.replace(")", "") || "0.5") * 100)}%
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-3 pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSubtitleStyle({ ...subtitleStyle, fontWeight: subtitleStyle.fontWeight === "bold" ? "normal" : "bold" })}
                              className="border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 hover:from-green-100 hover:to-emerald-100 hover:text-green-800 hover:border-green-400 font-semibold shadow-md"
                            >
                              {subtitleStyle.fontWeight === "bold" ? "굵게" : "보통"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSubtitleStyle({ ...subtitleStyle, textShadow: !subtitleStyle.textShadow })}
                              className="border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 hover:from-green-100 hover:to-emerald-100 hover:text-green-800 hover:border-green-400 font-semibold shadow-md"
                            >
                              {subtitleStyle.textShadow ? "그림자 ON" : "그림자 OFF"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* BGM 추가 */}
                  <Collapsible>
                    <CollapsibleTrigger className="w-full group">
                      <Card className="border border-purple-200/50 rounded-xl shadow-sm bg-white/80 hover:bg-white transition-all">
                        <CardHeader className="py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Volume2 className="w-5 h-5 text-purple-600" />
                              <CardTitle className="text-base font-semibold text-slate-800">배경음악 (BGM)</CardTitle>
                            </div>
                            <ChevronDown className="w-5 h-5 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                          </div>
                        </CardHeader>
                      </Card>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Card className="border border-purple-200/50 rounded-xl shadow-sm bg-white/80 mt-2">
                        <CardContent className="space-y-5 py-6">
                          <div className="space-y-3">
                            <Label className="text-sm font-semibold text-slate-700">BGM 파일 업로드 (선택사항)</Label>
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <input
                                  type="file"
                                  accept="audio/*"
                                  onChange={handleBgmUpload}
                                  className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-purple-500 file:to-pink-500 file:text-white hover:file:from-purple-400 hover:file:to-pink-400 file:cursor-pointer bg-white/80 border border-slate-200 rounded-lg p-2 shadow-sm"
                                />
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  console.log("[Shopping] BGM 라이브러리 버튼 클릭")
                                  console.log("[Shopping] 현재 showBgmLibraryDialog:", showBgmLibraryDialog)
                                  setTimeout(() => {
                                    setShowBgmLibraryDialog(true)
                                    console.log("[Shopping] setShowBgmLibraryDialog(true) 호출 후")
                                  }, 0)
                                }}
                                className="whitespace-nowrap"
                              >
                                <FolderOpen className="w-4 h-4 mr-2" />
                                라이브러리
                              </Button>
                            </div>
                            {bgmUrl && (
                              <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-xl backdrop-blur-sm">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                    <p className="text-sm text-green-600 font-medium">BGM이 업로드되었습니다.</p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleDeleteBgm}
                                    className="h-8 px-3"
                                  >
                                    <X className="w-4 h-4 mr-1" />
                                    삭제
                                  </Button>
                                </div>
                                <audio controls src={bgmUrl} className="w-full" />
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-1 gap-5 pt-2">
                            <div className="space-y-3">
                              <Label className="text-sm font-semibold text-slate-700">BGM 볼륨</Label>
                              <div className="flex items-center gap-3">
                                <Slider
                                  value={[bgmVolume]}
                                  onValueChange={([value]) => setBgmVolume(value)}
                                  min={0}
                                  max={1}
                                  step={0.1}
                                  className="flex-1"
                                />
                                <span className="text-sm text-slate-500 font-medium w-14 text-right">{Math.round(bgmVolume * 100)}%</span>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <Label className="text-sm font-semibold text-slate-700">TTS 볼륨</Label>
                              <div className="flex items-center gap-3">
                                <Slider
                                  value={[ttsVolume]}
                                  onValueChange={([value]) => setTtsVolume(value)}
                                  min={0}
                                  max={1}
                                  step={0.1}
                                  className="flex-1"
                                />
                                <span className="text-sm text-slate-500 font-medium w-14 text-right">{Math.round(ttsVolume * 100)}%</span>
                              </div>
                            </div>
                            {bgmUrl && (
                              <>
                                <div className="space-y-3 pt-2 border-t border-slate-200">
                                  <Label className="text-sm font-semibold text-slate-700">BGM 재생 시간대</Label>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                      <Label className="text-xs text-slate-600">시작 시간 (초)</Label>
                                      <Input
                                        type="number"
                                        value={bgmStartTime}
                                        onChange={(e) => setBgmStartTime(Math.max(0, parseFloat(e.target.value) || 0))}
                                        min={0}
                                        step={0.1}
                                        className="bg-white/80 border-slate-200"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-xs text-slate-600">종료 시간 (초)</Label>
                                      <Input
                                        type="number"
                                        value={bgmEndTime}
                                        onChange={(e) => setBgmEndTime(Math.max(bgmStartTime, parseFloat(e.target.value) || 0))}
                                        min={bgmStartTime}
                                        step={0.1}
                                        className="bg-white/80 border-slate-200"
                                      />
                                    </div>
                                  </div>
                                  <p className="text-xs text-slate-500">
                                    {bgmStartTime.toFixed(1)}초 ~ {bgmEndTime.toFixed(1)}초 구간에 BGM이 재생됩니다
                                  </p>
                                </div>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* 효과음 추가 */}
                  <Collapsible>
                    <CollapsibleTrigger className="w-full group">
                      <Card className="border border-blue-200/50 rounded-xl shadow-sm bg-white/80 hover:bg-white transition-all">
                        <CardHeader className="py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Volume2 className="w-5 h-5 text-blue-600" />
                              <CardTitle className="text-base font-semibold text-slate-800">효과음 (SFX)</CardTitle>
                            </div>
                            <ChevronDown className="w-5 h-5 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                          </div>
                        </CardHeader>
                      </Card>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Card className="border border-blue-200/50 rounded-xl shadow-sm bg-white/80 mt-2">
                        <CardContent className="space-y-5 py-6">
                          <div className="space-y-3">
                            <Label className="text-sm font-semibold text-slate-700">효과음 파일 업로드 (선택사항)</Label>
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <input
                                  type="file"
                                  accept="audio/*"
                                  onChange={handleSfxUpload}
                                  className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-blue-500 file:to-cyan-500 file:text-white hover:file:from-blue-400 hover:file:to-cyan-400 file:cursor-pointer bg-white/80 border border-slate-200 rounded-lg p-2 shadow-sm"
                                />
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  console.log("[Shopping] 효과음 라이브러리 버튼 클릭 - 이벤트:", e)
                                  console.log("[Shopping] 현재 showSfxLibraryDialog:", showSfxLibraryDialog)
                                  console.log("[Shopping] setShowSfxLibraryDialog(true) 호출 직전")
                                  setShowSfxLibraryDialog(true)
                                  console.log("[Shopping] setShowSfxLibraryDialog(true) 호출 후")
                                  // 상태가 실제로 변경되었는지 확인
                                  setTimeout(() => {
                                    console.log("[Shopping] 100ms 후 showSfxLibraryDialog 상태:", showSfxLibraryDialog)
                                  }, 100)
                                }}
                                className="whitespace-nowrap"
                              >
                                <FolderOpen className="w-4 h-4 mr-2" />
                                라이브러리
                              </Button>
                            </div>
                            {sfxUrl && (
                              <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-xl backdrop-blur-sm">
                                <div className="flex items-center gap-2 mb-3">
                                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                                  <p className="text-sm text-green-600 font-medium">효과음이 업로드되었습니다.</p>
                                </div>
                                <audio controls src={sfxUrl} className="w-full" />
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-1 gap-5 pt-2">
                            <div className="space-y-3">
                              <Label className="text-sm font-semibold text-slate-700">효과음 볼륨</Label>
                              <div className="flex items-center gap-3">
                                <Slider
                                  value={[sfxVolume]}
                                  onValueChange={([value]) => setSfxVolume(value)}
                                  min={0}
                                  max={1}
                                  step={0.1}
                                  className="flex-1"
                                />
                                <span className="text-sm text-slate-500 font-medium w-14 text-right">{Math.round(sfxVolume * 100)}%</span>
                              </div>
                            </div>
                            {sfxUrl && (
                              <>
                                <div className="space-y-3 pt-2 border-t border-slate-200">
                                  <Label className="text-sm font-semibold text-slate-700">효과음 재생 시간대</Label>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                      <Label className="text-xs text-slate-600">시작 시간 (초)</Label>
                                      <Input
                                        type="number"
                                        value={sfxStartTime}
                                        onChange={(e) => setSfxStartTime(Math.max(0, parseFloat(e.target.value) || 0))}
                                        min={0}
                                        step={0.1}
                                        className="bg-white/80 border-slate-200"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-xs text-slate-600">종료 시간 (초)</Label>
                                      <Input
                                        type="number"
                                        value={sfxEndTime}
                                        onChange={(e) => setSfxEndTime(Math.max(sfxStartTime, parseFloat(e.target.value) || 0))}
                                        min={sfxStartTime}
                                        step={0.1}
                                        className="bg-white/80 border-slate-200"
                                      />
                                    </div>
                                  </div>
                                  <p className="text-xs text-slate-500">
                                    {sfxStartTime.toFixed(1)}초 ~ {sfxEndTime.toFixed(1)}초 구간에 효과음이 재생됩니다
                                  </p>
                                </div>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </CollapsibleContent>
                  </Collapsible>


                  {/* 유튜브 제목/설명/태그 생성기 */}
                  <Collapsible>
                    <CollapsibleTrigger className="w-full group">
                      <Card className="border border-yellow-200/50 rounded-xl shadow-sm bg-white/80 hover:bg-white transition-all">
                        <CardHeader className="py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-yellow-600" />
                              <CardTitle className="text-base font-semibold text-slate-800">유튜브 제목/설명/태그 생성기</CardTitle>
                            </div>
                            <ChevronDown className="w-5 h-5 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                          </div>
                        </CardHeader>
                      </Card>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Card className="border border-yellow-200/50 rounded-xl shadow-sm bg-white/80 mt-2">
                        <CardHeader className="relative z-10 border-b border-yellow-100">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-100 to-orange-100 border border-yellow-200/50 shadow-sm">
                                <FileText className="w-5 h-5 text-yellow-600" />
                              </div>
                              <CardTitle className="text-lg font-bold text-slate-800">유튜브 제목/설명/태그 생성기</CardTitle>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleGenerateMetadata}
                              disabled={isGeneratingMetadata || !script.trim()}
                              className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white border-0 font-semibold shadow-lg shadow-yellow-500/50"
                            >
                              {isGeneratingMetadata ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  생성 중...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4 mr-2" />
                                  재생성
                                </>
                              )}
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-5 py-6 relative z-10">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-semibold text-slate-700">제목</Label>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  if (youtubeTitle) {
                                    await navigator.clipboard.writeText(youtubeTitle)
                                    setCopiedTitle(true)
                                    setTimeout(() => setCopiedTitle(false), 2000)
                                  }
                                }}
                                className="h-7 px-2"
                              >
                                {copiedTitle ? (
                                  <>
                                    <Check className="w-3 h-3 mr-1 text-green-600" />
                                    <span className="text-xs text-green-600">복사됨</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 mr-1" />
                                    <span className="text-xs">복사</span>
                                  </>
                                )}
                              </Button>
                            </div>
                            <Input
                              value={youtubeTitle}
                              onChange={(e) => setYoutubeTitle(e.target.value)}
                              placeholder="유튜브 영상 제목"
                              className="bg-white/80 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-yellow-400 focus:ring-yellow-400/20 shadow-sm"
                            />
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-semibold text-slate-700">설명</Label>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  if (youtubeDescription) {
                                    await navigator.clipboard.writeText(youtubeDescription)
                                    setCopiedDescription(true)
                                    setTimeout(() => setCopiedDescription(false), 2000)
                                  }
                                }}
                                className="h-7 px-2"
                              >
                                {copiedDescription ? (
                                  <>
                                    <Check className="w-3 h-3 mr-1 text-green-600" />
                                    <span className="text-xs text-green-600">복사됨</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 mr-1" />
                                    <span className="text-xs">복사</span>
                                  </>
                                )}
                              </Button>
                            </div>
                            <Textarea
                              value={youtubeDescription}
                              onChange={(e) => setYoutubeDescription(e.target.value)}
                              rows={4}
                              placeholder="유튜브 영상 설명"
                              className="resize-none bg-white/80 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-yellow-400 focus:ring-yellow-400/20 shadow-sm"
                            />
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-semibold text-slate-700">태그</Label>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  if (youtubeTags.length > 0) {
                                    await navigator.clipboard.writeText(youtubeTags.join(", "))
                                    setCopiedTags(true)
                                    setTimeout(() => setCopiedTags(false), 2000)
                                  }
                                }}
                                className="h-7 px-2"
                              >
                                {copiedTags ? (
                                  <>
                                    <Check className="w-3 h-3 mr-1 text-green-600" />
                                    <span className="text-xs text-green-600">복사됨</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 mr-1" />
                                    <span className="text-xs">복사</span>
                                  </>
                                )}
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {youtubeTags.map((tag, index) => (
                                <span
                                  key={index}
                                  className="px-3 py-1.5 bg-gradient-to-r from-yellow-100 to-orange-100 border border-yellow-200/50 text-yellow-700 rounded-full text-sm font-medium shadow-sm"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <Input
                              value={youtubeTags.join(", ")}
                              onChange={(e) => setYoutubeTags(e.target.value.split(",").map(t => t.trim()).filter(t => t))}
                              placeholder="태그를 쉼표로 구분하여 입력"
                              className="bg-white/80 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-yellow-400 focus:ring-yellow-400/20 shadow-sm"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </div>

              {/* 우측: 미리보기 영역 */}
              <div className="lg:col-span-2">
                <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Video className="w-5 h-5" />
                      영상 미리보기
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      {/* 영상 미리보기 */}
                      <div className="flex justify-center items-start">
                        {/* 비디오 미리보기 (롱폼 방식: HTML video 엘리먼트) */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium text-center text-gray-600">영상 미리보기</h3>
                          <div className="relative" style={{ width: "300px", height: "533px" }}>
                            {previewGenerated && convertedVideoUrls.size === 3 ? (
                              <>
                                <video
                                  ref={previewVideoRef}
                                  crossOrigin="anonymous"
                                  muted
                                  playsInline
                                  loop={false}
                                  className="w-full h-full border-2 border-gray-300 rounded-lg object-cover"
                                  style={{ 
                                    aspectRatio: "9/16",
                                    opacity: videoTransitionOpacity,
                                    transition: "opacity 0.05s ease-in-out"
                                  }}
                                />
                                {/* 썸네일 오버레이 (0.01초 동안) */}
                                {previewThumbnailImage && currentTime < 0.01 && (
                                  <img
                                    src={previewThumbnailImage.src}
                                    alt="썸네일"
                                    className="absolute top-0 left-0 w-full h-full object-cover border-2 border-gray-300 rounded-lg"
                                    style={{ aspectRatio: "9/16" }}
                                  />
                                )}
                                {/* 자막 오버레이 (미리보기 크기에 맞춤, subtitleStyle 적용) */}
                                {currentSubtitle && currentTime >= 0.01 && (
                                  <div 
                                    className="absolute left-0 right-0 flex items-center justify-center pointer-events-none"
                                    style={{
                                      top: (() => {
                                        // 기본 위치 계산
                                        let basePercent = subtitleStyle.position === "top" ? 15 : subtitleStyle.position === "center" ? 50 : 85
                                        // positionOffset을 퍼센트로 변환 (533px 기준, -200~+200px를 -37.5%~+37.5%로 변환)
                                        const offsetPercent = (subtitleStyle.positionOffset / 533) * 100
                                        return `${basePercent + offsetPercent}%`
                                      })(),
                                      justifyContent: subtitleStyle.textAlign === "center" ? "center" : subtitleStyle.textAlign === "right" ? "flex-end" : "flex-start",
                                      padding: "0 20px",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontFamily: `'${subtitleStyle.fontFamily}', sans-serif`,
                                        fontSize: `${subtitleStyle.fontSize * 0.6}px`, // 미리보기 크기에 맞춰 스케일링
                                        fontWeight: subtitleStyle.fontWeight,
                                        textAlign: subtitleStyle.textAlign,
                                        color: subtitleStyle.color,
                                        backgroundColor: subtitleStyle.backgroundColor,
                                        padding: "8px 16px",
                                        borderRadius: "8px",
                                        lineHeight: "1.2",
                                        textShadow: subtitleStyle.textShadow ? "2px 2px 4px rgba(0,0,0,0.8)" : "none",
                                      }}
                                    >
                                      {currentSubtitle}
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="w-full h-full border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                                <span className="text-gray-400 text-sm">미리보기를 생성해주세요</span>
                              </div>
                            )}
                          </div>
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

                    {/* 재생바 - 캡컷 스타일 */}
                    {previewAudio && (
                      <div className="bg-slate-800 rounded-lg p-4 space-y-0">
                        {/* 상단 시간 눈금 (통합) */}
                        {previewAudio.duration > 0 && (
                          <div className="relative w-full h-14 mb-2 border-b border-slate-600">
                            {/* 초 단위 눈금 및 레이블 (모든 초 표시) */}
                            {Array.from({ length: Math.floor(previewAudio.duration) + 1 }, (_, i) => {
                              const timeInSeconds = i
                              if (timeInSeconds > previewAudio.duration) return null
                              const leftPercent = (timeInSeconds / previewAudio.duration) * 100
                              const isMinuteMark = timeInSeconds % 60 === 0
                              const isTenSecondMark = timeInSeconds % 10 === 0
                              const isFiveSecondMark = timeInSeconds % 5 === 0
                              
                              // 1초마다 작은 눈금 표시
                              // 5초마다 중간 크기 눈금 표시
                              // 10초마다 큰 눈금 표시
                              // 60초(1분)마다 가장 큰 눈금 표시
                              const tickHeight = isMinuteMark ? 'h-6' : isTenSecondMark ? 'h-5' : isFiveSecondMark ? 'h-3' : 'h-2'
                              const tickColor = isMinuteMark ? 'bg-slate-300' : isTenSecondMark ? 'bg-slate-400' : isFiveSecondMark ? 'bg-slate-500' : 'bg-slate-500/60'
                              
                              // 모든 초에 레이블 표시
                              return (
                                <div
                                  key={`tick-${timeInSeconds}`}
                                  className="absolute top-0 bottom-0 flex flex-col items-center"
                                  style={{ left: `${leftPercent}%`, transform: 'translateX(-50%)' }}
                                >
                                  <div className={`w-px ${tickHeight} ${tickColor}`}></div>
                                  <span className={`text-[8px] text-slate-300 mt-0.5 whitespace-nowrap ${isMinuteMark ? 'font-semibold' : isTenSecondMark ? 'font-medium' : 'font-normal'}`}>
                                    {timeInSeconds}초
                                  </span>
                                </div>
                              )
                            })}
                            {/* 현재 재생 위치 표시 (상단 눈금에서도) */}
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-30 pointer-events-none"
                              style={{ left: `${(currentTime / previewAudio.duration) * 100}%` }}
                            />
                          </div>
                        )}

                        {/* 트랙 영역 */}
                        <div className="space-y-3">
                          {/* 메인 재생바 (재생 위치 조정용) */}
                          <div className="relative">
                            <div className="flex items-center gap-2 mb-1">
                              <Label className="text-xs text-slate-300">재생 위치</Label>
                            </div>
                            <div 
                              ref={timelineRef}
                              className="relative h-8 bg-slate-700 rounded cursor-pointer border border-slate-600"
                              onClick={(e) => {
                                if (!previewAudio || draggingBgmHandle || draggingSfxHandle) return
                                const rect = e.currentTarget.getBoundingClientRect()
                                const clickX = e.clientX - rect.left
                                const percentage = Math.max(0, Math.min(1, clickX / rect.width))
                                const newTime = percentage * previewAudio.duration
                                previewAudio.currentTime = newTime
                                setCurrentTime(newTime)
                                
                                // 비디오 시간 동기화
                                if (previewVideoRef.current) {
                                  const video = previewVideoRef.current
                                  const THUMBNAIL_DURATION = 0.0001
                                  const adjustedElapsed = Math.max(0, newTime - THUMBNAIL_DURATION)
                                  
                                  if (!isNaN(video.duration) && video.duration > 0) {
                                    const videoTime = adjustedElapsed % video.duration
                                    video.currentTime = videoTime
                                  }
                                }
                              }}
                            >
                              {/* 현재 재생 위치 표시 */}
                              {previewAudio.duration > 0 && (
                                <div
                                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-20 pointer-events-none"
                                  style={{ left: `${(currentTime / previewAudio.duration) * 100}%` }}
                                />
                              )}
                            </div>
                          </div>

                          {/* BGM 트랙 */}
                          {bgmUrl && (
                            <div className="relative">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                                <Label className="text-xs text-slate-300">BGM</Label>
                                <span className="text-[10px] text-slate-400 ml-auto">
                                  {bgmStartTime.toFixed(1)}초 ~ {bgmEndTime.toFixed(1)}초
                                </span>
                              </div>
                              <div 
                                ref={bgmTimelineRef}
                                className="relative h-10 bg-slate-700 rounded border border-slate-600"
                              >
                                {/* BGM 범위 표시 */}
                                {previewAudio.duration > 0 && (
                                  <>
                                    <div
                                      className="absolute h-full bg-purple-500/50 rounded border-y border-purple-400/50"
                                      style={{
                                        left: `${(bgmStartTime / previewAudio.duration) * 100}%`,
                                        width: `${((bgmEndTime - bgmStartTime) / previewAudio.duration) * 100}%`,
                                      }}
                                    />
                                    {/* BGM 시작 핸들 */}
                                    <div
                                      className="absolute -top-1 -bottom-1 w-2 bg-purple-600 cursor-ew-resize hover:bg-purple-500 hover:w-3 z-10 rounded transition-all border-2 border-white shadow-lg"
                                      style={{ left: `calc(${(bgmStartTime / previewAudio.duration) * 100}% - 4px)` }}
                                      onMouseDown={(e) => {
                                        e.stopPropagation()
                                        setDraggingBgmHandle("start")
                                      }}
                                    />
                                    {/* BGM 종료 핸들 */}
                                    <div
                                      className="absolute -top-1 -bottom-1 w-2 bg-purple-600 cursor-ew-resize hover:bg-purple-500 hover:w-3 z-10 rounded transition-all border-2 border-white shadow-lg"
                                      style={{ left: `calc(${(bgmEndTime / previewAudio.duration) * 100}% - 4px)` }}
                                      onMouseDown={(e) => {
                                        e.stopPropagation()
                                        setDraggingBgmHandle("end")
                                      }}
                                    />
                                    {/* 현재 재생 위치 표시 */}
                                    <div
                                      className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-20 pointer-events-none"
                                      style={{ left: `${(currentTime / previewAudio.duration) * 100}%` }}
                                    />
                                  </>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 효과음 트랙 */}
                          {sfxUrl && (
                            <div className="relative">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                <Label className="text-xs text-slate-300">효과음</Label>
                                <span className="text-[10px] text-slate-400 ml-auto">
                                  {sfxStartTime.toFixed(1)}초 ~ {sfxEndTime.toFixed(1)}초
                                </span>
                              </div>
                              <div 
                                ref={sfxTimelineRef}
                                className="relative h-10 bg-slate-700 rounded border border-slate-600"
                              >
                                {/* 효과음 범위 표시 */}
                                {previewAudio.duration > 0 && (
                                  <>
                                    <div
                                      className="absolute h-full bg-blue-500/50 rounded border-y border-blue-400/50"
                                      style={{
                                        left: `${(sfxStartTime / previewAudio.duration) * 100}%`,
                                        width: `${((sfxEndTime - sfxStartTime) / previewAudio.duration) * 100}%`,
                                      }}
                                    />
                                    {/* 효과음 시작 핸들 */}
                                    <div
                                      className="absolute -top-1 -bottom-1 w-2 bg-blue-600 cursor-ew-resize hover:bg-blue-500 hover:w-3 z-10 rounded transition-all border-2 border-white shadow-lg"
                                      style={{ left: `calc(${(sfxStartTime / previewAudio.duration) * 100}% - 4px)` }}
                                      onMouseDown={(e) => {
                                        e.stopPropagation()
                                        setDraggingSfxHandle("start")
                                      }}
                                    />
                                    {/* 효과음 종료 핸들 */}
                                    <div
                                      className="absolute -top-1 -bottom-1 w-2 bg-blue-600 cursor-ew-resize hover:bg-blue-500 hover:w-3 z-10 rounded transition-all border-2 border-white shadow-lg"
                                      style={{ left: `calc(${(sfxEndTime / previewAudio.duration) * 100}% - 4px)` }}
                                      onMouseDown={(e) => {
                                        e.stopPropagation()
                                        setDraggingSfxHandle("end")
                                      }}
                                    />
                                    {/* 현재 재생 위치 표시 */}
                                    <div
                                      className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-20 pointer-events-none"
                                      style={{ left: `${(currentTime / previewAudio.duration) * 100}%` }}
                                    />
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 현재 시간 표시 */}
                        <div className="flex items-center justify-between text-sm text-slate-300 mt-3 pt-3 border-t border-slate-600">
                          <span>{Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, "0")}</span>
                          <span>{Math.floor((previewAudio.duration || 0) / 60)}:{(Math.floor((previewAudio.duration || 0) % 60)).toString().padStart(2, "0")}</span>
                        </div>
                      </div>
                    )}
                  </div>


                  {/* 미리보기 생성 및 다운로드 버튼 */}
                  <div className="space-y-3">
                    {/* 미리보기 생성 버튼 */}
                    <Button
                      onClick={handleGeneratePreview}
                      disabled={isGeneratingPreview || convertedVideoUrls.size !== 3 || !ttsAudioUrl}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
                      size="lg"
                    >
                      {isGeneratingPreview ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          미리보기 생성 중...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          미리보기 생성
                        </>
                      )}
                    </Button>

                  {/* 렌더링 / 다운로드 / 예약 발행 버튼 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {videoUrl ? (
                    <Button
                          onClick={handleDownload}
                          className="bg-green-500 hover:bg-green-600 text-white"
                          size="lg"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          영상 다운로드
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleRenderVideo()}
                      disabled={isRendering || !previewGenerated}
                          className="bg-orange-500 hover:bg-orange-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
                      size="lg"
                    >
                          {isRendering && !isScheduling ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          렌더링 중...
                        </>
                      ) : (
                        <>
                        <Download className="w-4 h-4 mr-2" />
                              영상 다운로드
                        </>
                      )}
                      </Button>
                      )}
                      <Button
                        onClick={handleServerDownload}
                        disabled={!previewGenerated || isServerDownloading}
                        variant="outline"
                        className="col-span-full border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        size="lg"
                      >
                        {isServerDownloading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            서버 렌더링 중...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" />
                            서버 다운로드
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleOpenScheduleModal}
                        disabled={isRendering || !previewGenerated}
                        variant="outline"
                        className="border-orange-300 text-orange-700 hover:bg-orange-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        size="lg"
                      >
                        {isScheduling ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            예약 생성 중...
                          </>
                        ) : (
                          <>
                            <CalendarClock className="w-4 h-4 mr-2" />
                            예약 발행
                          </>
                        )}
                      </Button>
                      {factoryAutoRunItem && (
                        <Button
                          onClick={() => handleServerDownload()}
                          disabled={!previewGenerated || isServerDownloading}
                          className="col-span-full bg-amber-600 hover:bg-amber-700 text-white"
                          size="lg"
                        >
                          {isServerDownloading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              서버 렌더링 중… (자동 진행)
                            </>
                          ) : (
                            <>
                              <Factory className="w-4 h-4 mr-2" />
                              공장 예약 완료
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                    {!previewGenerated && (
                      <p className="text-sm text-gray-500 text-center">
                        먼저 미리보기를 생성해주세요
                      </p>
                    )}
                    {factoryAutoRunItem && previewGenerated && !isServerDownloading && (
                      <p className="text-xs text-amber-700 text-center">
                        미리보기 생성 후 서버 렌더링이 자동으로 시작됩니다.
                      </p>
                    )}
                    </div>

                    {/* 이전/처음으로 버튼 */}
                    <div className="flex gap-3 pt-4 border-t border-gray-200">
                      <Button
                        variant="outline"
                        onClick={() => setActiveStep("render")}
                        className="flex-1 border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 hover:from-orange-100 hover:to-amber-100 hover:text-orange-800 hover:border-orange-400 font-semibold shadow-md transition-all"
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
                        className="flex-1 border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 hover:from-orange-100 hover:to-amber-100 hover:text-orange-800 hover:border-orange-400 font-semibold shadow-md transition-all"
                      >
                        <Home className="w-4 h-4 mr-2" />
                        처음으로
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )

      case "render":
        return (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                영상 생성
              </h2>
              <p className="text-slate-600 text-base">영상 설정을 구성하고 생성하세요</p>
            </div>

            {/* 생성된 영상 실시간 표시 */}
            {/* 영상이 하나라도 생성 중이거나 생성된 경우 표시 */}
            {(convertedVideoUrls.size > 0 || isConvertingToVideo.get(0) || isConvertingToVideo.get(1) || isConvertingToVideo.get(2)) && (
              <Card className="border border-blue-200 rounded-2xl shadow-lg bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="w-5 h-5 text-blue-600" />
                    개별 영상 생성 중 ({convertedVideoUrls.size}/3)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[0, 1, 2].map((index) => {
                      const videoUrl = convertedVideoUrls.get(index)
                      const isConverting = isConvertingToVideo.get(index)
                      const isGeneratingPrompt = isGeneratingVideoPrompts.get(index)
                      const videoPrompt = videoPrompts.get(index)
                      const sceneNames = ["제품 사용 영상", "디테일 영상", "다른 배경 영상"]
                      
                      // 생성 완료된 영상
                      if (videoUrl && !isConverting) {
                        return (
                          <div key={index} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-semibold text-slate-700">{sceneNames[index]}</Label>
                              <Button
                                onClick={() => handleRegenerateSingleVideo(index as 0 | 1 | 2)}
                                disabled={isConvertingToVideo.get(index)}
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 hover:from-orange-100 hover:to-amber-100 hover:text-orange-800 hover:border-orange-400"
                              >
                                {isConvertingToVideo.get(index) ? (
                                  <>
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    생성 중
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="w-3 h-3 mr-1" />
                                    재생성
                                  </>
                                )}
                              </Button>
                            </div>
                            {/* 영상 프롬프트 표시 (Collapsible) */}
                            {videoPrompt && (
                              <Collapsible>
                                <CollapsibleTrigger className="w-full">
                                  <div className="flex items-center justify-between w-full p-2 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors">
                                    <span className="text-xs font-semibold text-blue-700">영상 프롬프트 보기</span>
                                    <ChevronDown className="w-4 h-4 text-blue-600" />
                                  </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <p className="text-xs font-medium text-slate-700 mb-1">프롬프트:</p>
                                    <p className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-200 font-mono break-words max-h-40 overflow-y-auto">
                                      {videoPrompt}
                                    </p>
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            )}
                            <div className="relative w-full aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-green-300 shadow-lg">
                              <video
                                src={videoUrl}
                                controls
                                className="w-full h-full object-cover"
                                crossOrigin="anonymous"
                              />
                              <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                                ✓ {index + 1}
                              </div>
                            </div>
                          </div>
                        )
                      }
                      
                      // 생성 중인 영상
                      if (isConverting || isGeneratingPrompt) {
                        const statusText = isGeneratingPrompt 
                          ? "프롬프트 생성 중..." 
                          : "영상 생성 중..."
                        
                        return (
                          <div key={index} className="space-y-2">
                            <Label className="text-sm font-semibold text-slate-700">{sceneNames[index]} ({statusText})</Label>
                            {/* 프롬프트 생성 중일 때 프롬프트 표시 */}
                            {isGeneratingPrompt && (
                              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="flex items-center gap-2">
                                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                                  <p className="text-xs text-blue-600 font-medium">영상 프롬프트 생성중</p>
                                </div>
                              </div>
                            )}
                            {/* 생성된 프롬프트 표시 (영상 생성 중일 때) */}
                            {videoPrompt && !isGeneratingPrompt && (
                              <Collapsible>
                                <CollapsibleTrigger className="w-full">
                                  <div className="flex items-center justify-between w-full p-2 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors">
                                    <span className="text-xs font-semibold text-green-700">생성된 프롬프트 보기</span>
                                    <ChevronDown className="w-4 h-4 text-green-600" />
                                  </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <p className="text-xs font-medium text-slate-700 mb-1">프롬프트:</p>
                                    <p className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-200 font-mono break-words max-h-40 overflow-y-auto">
                                      {videoPrompt}
                                    </p>
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            )}
                            <div className="relative w-full aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-blue-500 shadow-lg">
                              {/* 원본 이미지 배경 */}
                              {imageUrls[index] && (
                                <img
                                  src={imageUrls[index]}
                                  alt={`원본 이미지 ${index + 1}`}
                                  className="w-full h-full object-cover opacity-50"
                                />
                              )}
                              {/* 로딩 오버레이 */}
                              <div className="absolute inset-0 bg-gradient-to-br from-blue-200/50 via-cyan-200/50 to-blue-300/50">
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="relative">
                                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                                    <Sparkles className="w-4 h-4 text-blue-400 absolute -top-1 -right-1 animate-bounce" />
                                  </div>
                                </div>
                                <div className="absolute bottom-2 left-2 right-2 text-[10px] text-blue-600 font-medium bg-white/90 px-2 py-1 rounded text-center">
                                  {statusText}
                                </div>
                              </div>
                              <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                                {index + 1}
                              </div>
                            </div>
                          </div>
                        )
                      }
                      
                      // 아직 시작하지 않은 영상 (원본 이미지 표시)
                      return (
                        <div key={index} className="space-y-2">
                          <Label className="text-sm font-semibold text-slate-700">{sceneNames[index]} (대기 중)</Label>
                          <div className="relative w-full aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-300 shadow-lg">
                            {imageUrls[index] ? (
                              <img
                                src={imageUrls[index]}
                                alt={`원본 이미지 ${index + 1}`}
                                className="w-full h-full object-cover opacity-70"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                <span className="text-gray-400 text-sm">이미지 없음</span>
                              </div>
                            )}
                            <div className="absolute top-2 right-2 bg-gray-400 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                              {index + 1}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
            

            {/* 영상이 없을 때 */}
            {convertedVideoUrls.size === 0 && (
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
                      {/* 이미지 표시 (3개) */}
                      <div className="flex justify-center">
                        <div className="space-y-4 w-full max-w-4xl">
                          <Label className="text-sm font-semibold text-slate-700 text-center block">생성된 이미지 (3개)</Label>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {imageUrls.map((url, index) => (
                              <div key={index} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm font-semibold text-slate-700">
                                    {imagePrompts[index]?.type || `이미지 ${index + 1}`}
                                  </Label>
                                  <Button
                                    onClick={() => handleRegenerateSingleImage(index as 0 | 1 | 2)}
                                    disabled={isRegeneratingImage.get(index)}
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-xs border-blue-300 bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 hover:from-blue-100 hover:to-cyan-100 hover:text-blue-800 hover:border-blue-400"
                                  >
                                    {isRegeneratingImage.get(index) ? (
                                      <>
                                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                        재생성 중
                                      </>
                                    ) : (
                                      <>
                                        <RefreshCw className="w-3 h-3 mr-1" />
                                        재생성
                                      </>
                                    )}
                                  </Button>
                                </div>
                                {/* 추가 프롬프트 입력 필드 */}
                                <div className="space-y-1">
                                  <Label className="text-xs text-slate-600">추가 프롬프트 (한국어)</Label>
                                  <Input
                                    type="text"
                                    placeholder="예: 밝은 조명, 자연스러운 배경, 고급스러운 느낌"
                                    value={customImagePrompts.get(index) || ""}
                                    onChange={(e) => {
                                      const newMap = new Map(customImagePrompts)
                                      newMap.set(index, e.target.value)
                                      setCustomImagePrompts(newMap)
                                    }}
                                    className="h-8 text-xs"
                                  />
                                  <p className="text-[10px] text-slate-500">
                                    재생성 시 기존 프롬프트에 추가됩니다
                                  </p>
                                </div>
                                <div className="relative w-full aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200 shadow-sm">
                                  {isRegeneratingImage.get(index) ? (
                                    <>
                                      <img
                                        src={url}
                                        alt={`생성된 이미지 ${index + 1}`}
                                        className="w-full h-full object-cover opacity-50"
                                      />
                                      <div className="absolute inset-0 bg-gradient-to-br from-blue-200/50 via-cyan-200/50 to-blue-300/50">
                                        <div className="absolute inset-0 flex items-center justify-center">
                                          <div className="relative">
                                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                                            <Sparkles className="w-4 h-4 text-blue-400 absolute -top-1 -right-1 animate-bounce" />
                                          </div>
                                        </div>
                                        <div className="absolute bottom-2 left-2 right-2 text-[10px] text-blue-600 font-medium bg-white/90 px-2 py-1 rounded text-center">
                                          AI가 이미지를 재생성 중...
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <img
                                      src={url}
                                      alt={`생성된 이미지 ${index + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                                    {index + 1}
                                  </div>
                                  <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs font-medium px-2 py-1 rounded">
                                    {imagePrompts[index]?.type || `이미지 ${index + 1}`}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="inline-block p-6 rounded-full bg-white/60 border border-slate-200 mb-4 shadow-sm">
                        <ImageIcon className="w-12 h-12 text-slate-400" />
                      </div>
                      <p className="text-slate-600 text-base">이미지가 생성되지 않았습니다.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 영상 생성/재생성 버튼 */}
            {imageUrls.length > 0 && (
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setActiveStep("video")
                    // 영상 생성 상태 초기화 (단계 전환 시)
                    setIsConvertingToVideo(new Map())
                  }}
                  className="flex-1 border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 hover:from-orange-100 hover:to-amber-100 hover:text-orange-800 hover:border-orange-400 font-semibold shadow-md transition-all"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  이전
                </Button>
                <Button
                  onClick={() => setActiveStep("thumbnail")}
                  disabled={convertedVideoUrls.size < 3}
                  className="flex-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 hover:from-purple-400 hover:via-pink-400 hover:to-purple-400 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/50 transition-all duration-300"
                  size="lg"
                >
                  다음
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                {/* 영상 생성/재생성 버튼 */}
                {convertedVideoUrls.size === 3 ? (
                  // 모든 영상이 생성된 경우: 재생성 버튼
                  <Button
                    onClick={() => {
                      // 재생성 시 기존 영상 초기화
                      setConvertedVideoUrls(new Map())
                      handleConvertAllImagesToVideos()
                    }}
                    disabled={isConvertingToVideo.size > 0}
                    className="flex-1 bg-gradient-to-r from-orange-500 via-red-500 to-orange-500 hover:from-orange-400 hover:via-red-400 hover:to-orange-400 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/50 hover:shadow-xl hover:shadow-orange-500/50 transition-all duration-300"
                    size="lg"
                  >
                    {isConvertingToVideo.size > 0 ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        AI가 영상을 생성하고 있습니다...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-5 h-5 mr-2" />
                        영상 재생성
                      </>
                    )}
                  </Button>
                ) : (
                  // 영상이 없거나 일부만 생성된 경우: 영상 생성 버튼
                  <Button
                    onClick={handleConvertAllImagesToVideos}
                    disabled={isConvertingToVideo.size > 0}
                    className="flex-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500 hover:from-blue-400 hover:via-cyan-400 hover:to-blue-400 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/50 hover:shadow-xl hover:shadow-blue-500/50 transition-all duration-300"
                    size="lg"
                  >
                    {isConvertingToVideo.size > 0 ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        {convertedVideoUrls.size > 0 ? (
                          <>개별 영상 생성 중 ({convertedVideoUrls.size}/3)</>
                        ) : (
                          <>AI가 영상을 생성하고 있습니다...</>
                        )}
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5 mr-2" />
                        {convertedVideoUrls.size > 0 ? (
                          <>영상 재생성 ({convertedVideoUrls.size}/3 완료)</>
                        ) : (
                          <>영상 생성</>
                        )}
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        )

      case "thumbnail":
        return (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                썸네일 생성
              </h2>
              <p className="text-slate-600 text-base">쇼츠 썸네일을 생성하세요</p>
            </div>

            {/* 생성 방식 선택 */}
            <Card className="border border-purple-200 rounded-2xl shadow-lg bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-purple-600" />
                  썸네일 생성 방식
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setThumbnailMode("ai")}
                    variant={thumbnailMode === "ai" ? "default" : "outline"}
                    className={`flex-1 ${thumbnailMode === "ai" ? "bg-purple-500 hover:bg-purple-600 text-white" : ""}`}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI 생성
                  </Button>
                  <Button
                    onClick={() => setThumbnailMode("manual")}
                    variant={thumbnailMode === "manual" ? "default" : "outline"}
                    className={`flex-1 ${thumbnailMode === "manual" ? "bg-purple-500 hover:bg-purple-600 text-white" : ""}`}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    직접 생성
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* AI 생성 모드 */}
            {thumbnailMode === "ai" && (
              <Card className="border border-purple-200 rounded-2xl shadow-lg bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    AI 썸네일 생성
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-center items-start">
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-center text-gray-600">썸네일 미리보기</h3>
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
                              AI 썸네일 생성
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
                </CardContent>
              </Card>
            )}

            {/* 직접 생성 모드 */}
            {thumbnailMode === "manual" && (
              <Card className="border border-purple-200 rounded-2xl shadow-lg bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-purple-600" />
                    직접 썸네일 생성
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 왼쪽: 이미지 선택 및 텍스트 입력 */}
                    <div className="space-y-4">
                      {/* 이미지 선택 */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-slate-700">이미지 선택</Label>
                        
                        {/* 이미지 업로드 */}
                        <div className="space-y-2">
                          <Label className="text-xs text-slate-500">이미지 파일 업로드</Label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleCustomThumbnailUpload}
                            className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-purple-500 file:to-pink-500 file:text-white hover:file:from-purple-400 hover:file:to-pink-400 file:cursor-pointer bg-white/80 border border-slate-200 rounded-lg p-2 shadow-sm"
                          />
                        </div>

                        {/* 생성된 이미지에서 선택 */}
                        {imageUrls.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-xs text-slate-500">이미지 생성 단계에서 생성한 이미지 선택</Label>
                            <div className="grid grid-cols-3 gap-2">
                              {imageUrls.map((url, index) => (
                                <div
                                  key={index}
                                  onClick={() => handleSelectGeneratedImage(url)}
                                  className={`relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${
                                    customThumbnailImage === url
                                      ? "border-purple-500 ring-2 ring-purple-300"
                                      : "border-gray-200 hover:border-purple-300"
                                  }`}
                                  style={{ aspectRatio: "9/16" }}
                                >
                                  <img
                                    src={url}
                                    alt={`생성된 이미지 ${index + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                  {customThumbnailImage === url && (
                                    <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                                      <CheckCircle2 className="w-6 h-6 text-purple-600" />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 텍스트 입력 */}
                      {customThumbnailImage && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-slate-700">첫 번째 줄 텍스트</Label>
                            <Input
                              value={customThumbnailText.line1}
                              onChange={(e) => setCustomThumbnailText({ ...customThumbnailText, line1: e.target.value })}
                              placeholder="첫 번째 줄 텍스트 입력"
                              className="bg-white/80 border-slate-200"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-slate-700">두 번째 줄 텍스트</Label>
                            <Input
                              value={customThumbnailText.line2}
                              onChange={(e) => setCustomThumbnailText({ ...customThumbnailText, line2: e.target.value })}
                              placeholder="두 번째 줄 텍스트 입력"
                              className="bg-white/80 border-slate-200"
                            />
                          </div>

                          {/* 텍스트 스타일 설정 */}
                          <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <Label className="text-sm font-semibold text-slate-700">텍스트 스타일 설정</Label>
                            
                            {/* 첫 번째 줄 색상 */}
                            <div className="space-y-2">
                              <Label className="text-xs text-slate-600">첫 번째 줄 색상</Label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={customThumbnailTextStyle.line1Color}
                                  onChange={(e) => setCustomThumbnailTextStyle({ ...customThumbnailTextStyle, line1Color: e.target.value })}
                                  className="w-12 h-10 rounded-lg border-2 border-slate-200 cursor-pointer"
                                />
                                <Input
                                  value={customThumbnailTextStyle.line1Color}
                                  onChange={(e) => setCustomThumbnailTextStyle({ ...customThumbnailTextStyle, line1Color: e.target.value })}
                                  className="flex-1 bg-white border-slate-200 text-sm"
                                  placeholder="#FFFFFF"
                                />
                              </div>
                            </div>

                            {/* 두 번째 줄 색상 */}
                            <div className="space-y-2">
                              <Label className="text-xs text-slate-600">두 번째 줄 색상</Label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={customThumbnailTextStyle.line2Color}
                                  onChange={(e) => setCustomThumbnailTextStyle({ ...customThumbnailTextStyle, line2Color: e.target.value })}
                                  className="w-12 h-10 rounded-lg border-2 border-slate-200 cursor-pointer"
                                />
                                <Input
                                  value={customThumbnailTextStyle.line2Color}
                                  onChange={(e) => setCustomThumbnailTextStyle({ ...customThumbnailTextStyle, line2Color: e.target.value })}
                                  className="flex-1 bg-white border-slate-200 text-sm"
                                  placeholder="#00FFCC"
                                />
                              </div>
                            </div>

                            {/* 글씨 크기 */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-slate-600">글씨 크기</Label>
                                <span className="text-xs text-slate-500">
                                  {customThumbnailTextStyle.fontSize ?? 100}px (48 ~ 200)
                                </span>
                              </div>
                              <Slider
                                value={[customThumbnailTextStyle.fontSize ?? 100]}
                                onValueChange={([value]) => setCustomThumbnailTextStyle({ ...customThumbnailTextStyle, fontSize: value })}
                                min={48}
                                max={200}
                                step={4}
                                className="w-full"
                              />
                            </div>

                            {/* 텍스트 위치 */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-slate-600">텍스트 위치</Label>
                                <span className="text-xs text-slate-500">
                                  {Math.round(customThumbnailTextStyle.position * 100)}% (상단: 0%, 하단: 100%)
                                </span>
                              </div>
                              <Slider
                                value={[customThumbnailTextStyle.position]}
                                onValueChange={([value]) => setCustomThumbnailTextStyle({ ...customThumbnailTextStyle, position: value })}
                                min={0}
                                max={1}
                                step={0.01}
                                className="w-full"
                              />
                            </div>

                            {/* 테두리 설정 */}
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs text-slate-600">테두리 두께</Label>
                                  <span className="text-xs text-slate-500">{customThumbnailTextStyle.strokeWidth}px</span>
                                </div>
                                <Slider
                                  value={[customThumbnailTextStyle.strokeWidth]}
                                  onValueChange={([value]) => setCustomThumbnailTextStyle({ ...customThumbnailTextStyle, strokeWidth: value })}
                                  min={0}
                                  max={20}
                                  step={1}
                                  className="w-full"
                                />
                              </div>
                              {customThumbnailTextStyle.strokeWidth > 0 && (
                                <div className="space-y-2">
                                  <Label className="text-xs text-slate-600">테두리 색상</Label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="color"
                                      value={customThumbnailTextStyle.strokeColor}
                                      onChange={(e) => setCustomThumbnailTextStyle({ ...customThumbnailTextStyle, strokeColor: e.target.value })}
                                      className="w-12 h-10 rounded-lg border-2 border-slate-200 cursor-pointer"
                                    />
                                    <Input
                                      value={customThumbnailTextStyle.strokeColor}
                                      onChange={(e) => setCustomThumbnailTextStyle({ ...customThumbnailTextStyle, strokeColor: e.target.value })}
                                      className="flex-1 bg-white border-slate-200 text-sm"
                                      placeholder="#000000"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* 이미지 확대/축소 */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-slate-600">이미지 크기</Label>
                                <span className="text-xs text-slate-500">
                                  {Math.round(customThumbnailTextStyle.imageScale * 100)}% (50% ~ 200%)
                                </span>
                              </div>
                              <Slider
                                value={[customThumbnailTextStyle.imageScale]}
                                onValueChange={([value]) => setCustomThumbnailTextStyle({ ...customThumbnailTextStyle, imageScale: value })}
                                min={0.5}
                                max={2.0}
                                step={0.1}
                                className="w-full"
                              />
                            </div>

                            {/* 텍스트 회전 */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-slate-600">텍스트 회전</Label>
                                <span className="text-xs text-slate-500">
                                  {customThumbnailTextStyle.textRotation}° (-180° ~ 180°)
                                </span>
                              </div>
                              <Slider
                                value={[customThumbnailTextStyle.textRotation]}
                                onValueChange={([value]) => setCustomThumbnailTextStyle({ ...customThumbnailTextStyle, textRotation: value })}
                                min={-180}
                                max={180}
                                step={1}
                                className="w-full"
                              />
                            </div>
                          </div>

                          <Button
                            onClick={handleSaveCustomThumbnail}
                            disabled={!customThumbnailText.line1 || !customThumbnailText.line2}
                            className="w-full bg-purple-500 hover:bg-purple-600 text-white"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            썸네일 저장
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* 오른쪽: 미리보기 */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-700">미리보기</Label>
                      <div className="relative" style={{ width: "300px", height: "533px" }}>
                        {customThumbnailImage ? (
                          <canvas
                            ref={thumbnailCanvasRef}
                            className="w-full h-full border-2 border-gray-300 rounded-lg"
                            style={{ aspectRatio: "9/16" }}
                          />
                        ) : (
                          <div className="w-full h-full border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                            <span className="text-gray-400 text-sm">이미지를 업로드해주세요</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 생성된 썸네일 목록 */}
            {thumbnailImages.length > 0 && (
              <Card className="border border-purple-200 rounded-2xl shadow-lg bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-purple-600" />
                    생성된 썸네일 목록 ({thumbnailImages.length}개)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {thumbnailImages.map((thumb, index) => (
                      <div
                        key={index}
                        onClick={() => handleSelectThumbnail(index)}
                        className={`relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${
                          selectedThumbnailIndex === index
                            ? "border-purple-500 ring-2 ring-purple-300 scale-105"
                            : "border-gray-200 hover:border-purple-300"
                        }`}
                        style={{ aspectRatio: "9/16" }}
                      >
                        <img
                          src={thumb.url}
                          alt={`썸네일 ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {selectedThumbnailIndex === index && (
                          <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-purple-600" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2">
                          {thumb.isCustom ? "직접 생성" : "AI 생성"}
                        </div>
                      </div>
                    ))}
                  </div>
                  {selectedThumbnailIndex >= 0 && (
                    <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-sm text-purple-700">
                        선택된 썸네일: {selectedThumbnailIndex + 1}번 ({thumbnailImages[selectedThumbnailIndex]?.isCustom ? "직접 생성" : "AI 생성"})
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 네비게이션 버튼 */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setActiveStep("render")}
                className="flex-1 border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 hover:from-orange-100 hover:to-amber-100 hover:text-orange-800 hover:border-orange-400 font-semibold shadow-md transition-all"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                이전
              </Button>
              <Button
                onClick={() => setActiveStep("preview")}
                disabled={selectedThumbnailIndex === -1 || !thumbnailUrl}
                className="flex-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 hover:from-purple-400 hover:via-pink-400 hover:to-purple-400 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/50 transition-all duration-300"
                size="lg"
              >
                다음
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-amber-50/20 relative overflow-hidden">
      {/* 배경 애니메이션 효과 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-200/40 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-200/40 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-orange-100/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto p-4 md:p-6 lg:p-8">
        {/* 헤더 */}
        <div className="mb-8 md:mb-10">
          <div className="flex items-center justify-between mb-6">
            <Link href="/WingsAIStudioShotForm">
              <Button 
                variant="ghost" 
                size="sm"
                className="text-slate-600 hover:text-slate-900 hover:bg-white/80 backdrop-blur-sm border border-slate-200/50"
              >
                <Home className="w-4 h-4 mr-2" />
                홈으로
              </Button>
            </Link>
            {!showProjectList && (
              <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-orange-100 to-amber-100 backdrop-blur-xl border border-orange-200/50 text-orange-700 text-sm font-semibold shadow-lg shadow-orange-200/50">
                <ShoppingBag className="w-4 h-4" />
                쇼핑 숏폼
              </div>
            )}
          </div>
          {currentProject && !showProjectList && (
            <div className="mb-6 text-center">
              <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-100 to-amber-100 backdrop-blur-xl border border-orange-200/50 rounded-full shadow-lg shadow-orange-200/30">
                <FolderOpen className="w-4 h-4 text-orange-600" />
                <span className="text-orange-700 font-semibold">{currentProject.name}</span>
              </div>
            </div>
          )}
          {!showProjectList && (
            <div className="text-center space-y-3">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-200/40 to-amber-200/40 blur-2xl rounded-3xl"></div>
                <h1 className="relative text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 bg-clip-text text-transparent mb-2">
                  AI 쇼핑 숏폼 제작
                </h1>
              </div>
              <p className="text-slate-600 text-base md:text-lg font-medium">
                AI가 제품 정보를 분석하여 전문적인 쇼핑 영상을 자동으로 제작합니다
              </p>
            </div>
          )}
          {factoryAutoRunItem && !showProjectList && (
            <div className="mb-4 p-4 rounded-xl bg-amber-100/90 border-2 border-amber-400/60 flex items-center justify-center gap-2 flex-wrap">
              <Factory className="w-5 h-5 text-amber-700" />
              <span className="font-semibold text-amber-900">공장 자동화 자동 생성:</span>
              <span className="text-amber-800">{factoryAutoRunItem.productName}</span>
              <span className="text-sm text-amber-700">· 완료 단계에서 「공장 예약 완료」를 누르면 공장 자동화 목록에 저장됩니다.</span>
            </div>
          )}
        </div>

        {/* 예약 발행 목록: 프로젝트 목록 화면에서만 표시 (수동 모드 제작 화면에서는 숨김) */}
        {showProjectList && (
          <Card className="mb-6 border-orange-200 bg-orange-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-orange-600" />
                예약 발행 목록
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                지정한 날짜에 영상을 다운로드할 수 있습니다. 완료 단계에서 「예약 발행」으로 등록하세요.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {scheduledItems.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-orange-200 rounded-lg">
                  예약된 영상이 없습니다. 영상 제작 후 <strong>완료</strong> 단계에서 「예약 발행」 버튼을 눌러 등록하세요.
                </p>
              ) : (
                scheduledItems
                  .slice()
                  .sort((a, b) => new Date(a.scheduleAt).getTime() - new Date(b.scheduleAt).getTime())
                  .map((item) => {
                    const at = new Date(item.scheduleAt)
                    const isPast = at <= new Date()
                    const dateStr = at.toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-orange-200 bg-white p-3 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 truncate">{item.productName}</p>
                          <p className="text-muted-foreground text-xs">{dateStr}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isPast ? (
                            <Button
                              size="sm"
                              className="bg-orange-500 hover:bg-orange-600"
                              onClick={() => handleDownloadScheduled(item)}
                            >
                              <Download className="w-4 h-4 mr-1" />
                              다운로드
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              D-{Math.ceil((at.getTime() - Date.now()) / 86400000)}
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleRemoveScheduled(item)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })
              )}
            </CardContent>
          </Card>
        )}

        {/* 진행 단계 표시 (프로젝트 목록이 아닐 때만 표시) */}
        {!showProjectList && (
          <div className="mb-6 md:mb-8">
            <div className="flex items-center justify-center gap-2 md:gap-4">
              {[
                { step: "product", label: "제품 입력", icon: ShoppingBag },
                { step: "script", label: "대본 및 TTS 생성", icon: FileText },
                { step: "video", label: "이미지 생성", icon: ImageIcon },
                { step: "render", label: "영상 생성", icon: Video },
                { step: "thumbnail", label: "썸네일 생성", icon: ImageIcon },
                { step: "preview", label: "완료", icon: CheckCircle2 },
              ].map((item, index) => {
                const Icon = item.icon
                const isActive = activeStep === item.step
                const isCompleted =
                  (activeStep === "script" && index < 1) ||
                  (activeStep === "video" && index < 2) ||
                  (activeStep === "render" && index < 3) ||
                  (activeStep === "thumbnail" && index < 4) ||
                  (activeStep === "preview" && index < 5)

                return (
                  <div key={item.step} className="flex items-center">
                    <div 
                      className="flex flex-col items-center relative cursor-pointer group"
                      onClick={() => {
                        const step = item.step as "product" | "script" | "video" | "render" | "thumbnail" | "preview"
                        setActiveStep(step)
                      }}
                    >
                      {/* 활성 단계 글로우 효과 */}
                      {isActive && (
                        <div className="absolute inset-0 rounded-full bg-orange-400/30 blur-xl animate-pulse" />
                      )}
                      
                      {/* 완료 단계 글로우 효과 */}
                      {isCompleted && (
                        <div className="absolute inset-0 rounded-full bg-green-400/20 blur-lg" />
                      )}
                      
                      <div
                        className={`relative w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-500 ${
                          isActive
                            ? "bg-orange-100 text-orange-600 scale-110 shadow-lg shadow-orange-500/50 animate-pulse"
                            : isCompleted
                              ? "bg-green-100 text-green-600 scale-105 shadow-md shadow-green-500/30 group-hover:scale-110 group-hover:shadow-lg"
                              : "bg-white text-slate-400 scale-100 border border-slate-200 group-hover:scale-105 group-hover:border-orange-300 group-hover:bg-orange-50"
                        }`}
                      >
                        <Icon 
                          className={`w-5 h-5 md:w-6 md:h-6 transition-all duration-300 ${
                            isActive ? "animate-bounce" : isCompleted ? "scale-110" : ""
                          }`}
                        />
                        
                        {/* 완료 체크마크 오버레이 */}
                        {isCompleted && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 md:w-7 md:h-7 text-green-600 animate-in zoom-in duration-300" />
                          </div>
                        )}
                      </div>
                      
                      <span
                        className={`text-xs md:text-sm mt-2 transition-all duration-300 ${
                          isActive
                            ? "text-orange-600 font-semibold scale-105"
                            : isCompleted
                              ? "text-green-600 font-medium group-hover:text-green-700"
                              : "text-slate-500 font-normal group-hover:text-orange-600"
                        }`}
                      >
                        {item.label}
                      </span>
                      
                      {/* 활성 단계 언더라인 애니메이션 */}
                      {isActive && (
                        <div className="relative w-full h-1 mt-1">
                          <div className="absolute inset-0 bg-orange-200 rounded-full" />
                          <div className="absolute inset-0 bg-orange-400 rounded-full animate-pulse" />
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500 to-transparent rounded-full animate-shimmer" />
                        </div>
                      )}
                    </div>
                    
                    {/* 연결선 애니메이션 */}
                    {index < 5 && (
                      <div className="relative w-8 md:w-12 h-0.5 mx-2 overflow-hidden">
                        {/* 배경선 */}
                        <div className="absolute inset-0 bg-gray-300" />
                        
                        {/* 진행 애니메이션 (완료된 경우) */}
                        {isCompleted && (
                          <div className="absolute inset-0 bg-green-400">
                            <div 
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-green-500 to-transparent animate-flow"
                              style={{
                                width: '50%',
                              }}
                            />
                          </div>
                        )}
                        
                        {/* 활성 단계 이전 연결선 (활성 단계로 진행 중) */}
                        {isActive && index > 0 && (
                          <div className="absolute inset-0 bg-green-400 animate-progress-line" />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 메인 컨텐츠 */}
        {showProjectList ? (
          <div className="space-y-6">
            {/* 프로젝트 목록 / 공장 자동화 탭 */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Button
                  variant={!showFactoryView ? "default" : "outline"}
                  onClick={() => setShowFactoryView(false)}
                  className={!showFactoryView ? "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-lg shadow-orange-500/50" : "border-orange-300 text-orange-700"}
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                    프로젝트 목록
                </Button>
                <Button
                  variant={showFactoryView ? "default" : "outline"}
                  onClick={() => {
                    if (showFactoryView) return
                    const pw = prompt("테스트 진행중\n\n비밀번호를 입력하세요.")
                    if (pw === "111") setShowFactoryView(true)
                    else if (pw !== null) alert("비밀번호가 올바르지 않습니다.")
                  }}
                  className={showFactoryView ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/50" : "border-amber-300 text-amber-700"}
                >
                  <Factory className="w-4 h-4 mr-2" />
                  공장 자동화
                </Button>
                </div>
              {!showFactoryView ? (
              <Button
                onClick={() => {
                  setShowCreateProjectDialog(true)
                  setNewProjectName("")
                  setNewProjectDescription("")
                }}
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-semibold shadow-lg shadow-orange-500/50"
              >
                <Plus className="w-4 h-4 mr-2" />
                새 프로젝트 만들기
              </Button>
              ) : (
                <div className="flex items-center gap-3">
                  {youtubeChannelName && (
                    <span className="text-sm font-medium text-amber-800 bg-amber-100/90 px-3 py-1.5 rounded-full border border-amber-300/80">
                      {youtubeChannelName}
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full text-amber-700 hover:bg-amber-100"
                    onClick={() => setShowFactorySettingsDialog(true)}
                    title="공장 자동화 설정"
                  >
                    <Settings className="w-5 h-5" />
                  </Button>
                  <Button
                    onClick={() => setShowAddFactoryScheduleDialog(true)}
                    className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold shadow-lg shadow-amber-500/50"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    예약 추가
              </Button>
                </div>
              )}
            </div>

            {!showFactoryView ? (
            <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 mt-2 text-base">쇼핑 숏폼 프로젝트를 관리하세요</p>
              </div>
            </div>

            {/* 프로젝트 검색 */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 z-10" />
              <Input
                placeholder="프로젝트 검색..."
                value={projectSearchQuery}
                onChange={(e) => setProjectSearchQuery(e.target.value)}
                className="pl-12 h-12 bg-white/80 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-orange-400 focus:ring-orange-400/20 backdrop-blur-sm shadow-sm"
              />
            </div>

            {/* 프로젝트 목록 */}
            {isLoadingProjects ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {projects
                  .filter((project) =>
                    project.name.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                    project.description?.toLowerCase().includes(projectSearchQuery.toLowerCase())
                  )
                  .map((project, index) => {
                    // 가장 최근에 저장한 프로젝트 하나만 '최근' 태그 표시 (정렬된 목록의 첫 번째)
                    const isRecent = index === 0
                    
                    return (
                    <Card 
                      key={project.id} 
                      className={`${isRecent ? "border-2 border-red-500" : "border border-orange-200/50"} hover:border-orange-400 transition-all duration-300 bg-white/80 backdrop-blur-xl shadow-xl hover:shadow-2xl hover:shadow-orange-200/50 hover:scale-[1.02] overflow-hidden relative group`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-orange-50/50 to-amber-50/30 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      {isRecent && (
                        <div className="absolute top-1 right-2 z-20">
                          <span className="px-2 py-1 text-xs font-bold text-white bg-gradient-to-r from-red-500 to-red-600 rounded-full shadow-lg border-2 border-white">
                            최근
                          </span>
                        </div>
                      )}
                      <CardHeader className="relative z-10">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            {isEditingProjectName && currentProject?.id === project.id ? (
                              <Input
                                value={editingProjectName}
                                onChange={(e) => setEditingProjectName(e.target.value)}
                                className="text-lg font-semibold bg-white/80 border-slate-200 text-slate-900"
                                autoFocus
                              />
                            ) : (
                              <CardTitle className="text-lg font-bold text-slate-800">{project.name}</CardTitle>
                            )}
                            {project.description && (
                              <p className="text-sm text-slate-600 mt-2 line-clamp-2">{project.description}</p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            {isEditingProjectName && currentProject?.id === project.id ? (
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    if (editingProjectName.trim()) {
                                      try {
                                        await updateShoppingProject(project.id, { name: editingProjectName })
                                        await loadProjects()
                                        setIsEditingProjectName(false)
                                        setEditingProjectName("")
                                      } catch (error) {
                                        alert("프로젝트 이름 변경에 실패했습니다.")
                                      }
                                    }
                                  }}
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setIsEditingProjectName(false)
                                    setEditingProjectName("")
                                  }}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setIsEditingProjectName(true)
                                  setEditingProjectName(project.name)
                                  setCurrentProject(project)
                                }}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteProject(project.id)}
                              className="text-red-500 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="relative z-10">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">생성</span>
                            <span className="text-slate-600 font-medium">{new Date(project.created_at).toLocaleDateString("ko-KR")}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">수정</span>
                            <span className="text-slate-600 font-medium">{new Date(project.updated_at).toLocaleDateString("ko-KR")}</span>
                          </div>
                          <Button
                            onClick={() => loadProject(project.id)}
                            className="w-full mt-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-semibold shadow-lg shadow-orange-500/50 hover:shadow-xl hover:shadow-orange-500/50 transition-all"
                          >
                            <FolderOpen className="w-4 h-4 mr-2" />
                            프로젝트 열기
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    )
                  })}
              </div>
            )}

            {projects.length === 0 && !isLoadingProjects && (
              <div className="text-center py-16">
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-orange-200/40 blur-2xl rounded-full"></div>
                  <div className="relative p-6 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 border border-orange-200/50 shadow-lg">
                    <ShoppingBag className="w-16 h-16 text-orange-600" />
                  </div>
                </div>
                <p className="text-slate-600 mb-6 text-lg">프로젝트가 없습니다</p>
                <Button
                  onClick={() => {
                    setShowCreateProjectDialog(true)
                    setNewProjectName("")
                    setNewProjectDescription("")
                  }}
                  className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-semibold shadow-lg shadow-orange-500/50 hover:shadow-xl hover:shadow-orange-500/50 px-8 py-6 text-lg"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  새 프로젝트 만들기
                </Button>
              </div>
            )}

            {/* 새 프로젝트 생성 다이얼로그 */}
            <Dialog open={showCreateProjectDialog} onOpenChange={setShowCreateProjectDialog}>
              <DialogContent className="bg-white/95 backdrop-blur-xl border border-orange-200/50 shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 border border-orange-200/50 shadow-sm">
                      <Plus className="w-5 h-5 text-orange-600" />
                    </div>
                    새 프로젝트 만들기
                  </DialogTitle>
                  <DialogDescription className="text-slate-600">
                    프로젝트 이름과 설명을 입력하여 새 프로젝트를 생성하세요.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-5 py-4">
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-semibold">프로젝트 이름</Label>
                    <Input
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="프로젝트 이름을 입력하세요"
                      className="bg-white/80 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-orange-400 focus:ring-orange-400/20 shadow-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-semibold">설명 (선택사항)</Label>
                    <Textarea
                      value={newProjectDescription}
                      onChange={(e) => setNewProjectDescription(e.target.value)}
                      placeholder="프로젝트 설명을 입력하세요"
                      rows={3}
                      className="bg-white/80 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-orange-400 focus:ring-orange-400/20 resize-none shadow-sm"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreateProjectDialog(false)
                      setNewProjectName("")
                      setNewProjectDescription("")
                    }}
                    className="border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 hover:from-orange-100 hover:to-amber-100 hover:text-orange-800 hover:border-orange-400 font-semibold shadow-md"
                  >
                    취소
                  </Button>
                  <Button
                    onClick={() => {
                      if (newProjectName.trim()) {
                        saveProject(undefined, true) // 새 프로젝트로 생성 (기존 프로젝트 덮어쓰기)
                      } else {
                        alert("프로젝트 이름을 입력해주세요.")
                      }
                    }}
                    disabled={isSavingProject}
                    className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-semibold shadow-lg shadow-orange-500/50"
                  >
                    {isSavingProject ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        생성 중...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        생성
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            </>
            ) : (
            /* 공장 자동화 뷰: n8n 스타일 컨베이어 + 예약 목록 */
            <div className="space-y-6">
              <p className="text-slate-600 text-base">날짜·상품·이미지·목소리를 정해두면 해당 날에 영상을 자동 생성합니다.</p>
              {/* 컨베이어 벨트 애니메이션 (n8n 스타일) */}
              {(() => {
                const generatingItem = factorySchedules.find((s) => s.status === "generating")
                const currentPhaseLabel = generatingItem?.phase ? getFactoryPhaseDisplayText(generatingItem.phase) : null
              return (
              <>
              <style>{`@keyframes factoryConveyor { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
              <div className="relative overflow-hidden rounded-2xl border-2 border-amber-300/60 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 p-4 shadow-inner">
                <div className="absolute inset-0 flex items-center pointer-events-none">
                  <div className="flex" style={{ width: "200%", animation: "factoryConveyor 20s linear infinite" }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <div key={i} className="flex items-center gap-4 shrink-0 px-8">
                        <div className="w-14 h-14 rounded-xl bg-amber-200/80 border-2 border-amber-400/60 shadow-md flex items-center justify-center">
                          <ShoppingBag className="w-7 h-7 text-amber-700" />
                        </div>
                        <div className="w-2 h-10 rounded-full bg-amber-400/50" />
                        <div className="w-14 h-14 rounded-xl bg-orange-200/80 border-2 border-orange-400/60 shadow-md flex items-center justify-center">
                          <Video className="w-7 h-7 text-orange-700" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="relative flex items-center justify-center py-6">
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${currentPhaseLabel ? "bg-amber-200/90 border-amber-500/80" : "bg-amber-100/90 border-amber-300/80"}`}>
                    <Cog className="w-5 h-5 text-amber-700 animate-spin" style={{ animationDuration: "3s" }} />
                    <span className="font-semibold text-amber-800">
                      {currentPhaseLabel ? (
                        <>작업 중 · 현재 단계: {currentPhaseLabel}</>
                      ) : (
                        <>공장 자동화 · 해당 날짜에 자동 생성</>
                      )}
                    </span>
                  </div>
                </div>
              </div>
              </>
              )
              })()}
              {/* 예약 달력: 해당 날짜에 예약이 있는지 한눈에 */}
              <div className="rounded-2xl border-2 border-amber-200/80 bg-white/95 p-4 md:p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-amber-900 flex items-center gap-2">
                    <CalendarClock className="w-5 h-5 text-amber-600" />
                    예약 달력
                  </h3>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-amber-700 hover:bg-amber-100"
                      onClick={() => {
                        const [y, m] = factoryCalendarMonth.split("-").map(Number)
                        const d = new Date(y, m - 2, 1)
                        setFactoryCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
                      }}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-medium text-slate-700 min-w-[7rem] text-center">
                      {new Date(factoryCalendarMonth + "-01").toLocaleDateString("ko-KR", { year: "numeric", month: "long" })}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-amber-700 hover:bg-amber-100"
                      onClick={() => {
                        const [y, m] = factoryCalendarMonth.split("-").map(Number)
                        const d = new Date(y, m, 1)
                        setFactoryCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
                      }}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {(() => {
                  const [year, month] = factoryCalendarMonth.split("-").map(Number)
                  const first = new Date(year, month - 1, 1)
                  const last = new Date(year, month, 0)
                  const startDay = first.getDay()
                  const daysInMonth = last.getDate()
                  const scheduledDates = new Set(
                    factorySchedules.map((s) => s.scheduledDate).filter((d) => d.startsWith(factoryCalendarMonth))
                  )
                  const today = new Date()
                  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
                  const weekDays = ["일", "월", "화", "수", "목", "금", "토"]
                  const blanks = Array.from({ length: startDay }, (_, i) => <div key={`b-${i}`} className="min-h-[3.5rem]" />)
                  const days = Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1
                    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                    const itemsOnDate = factorySchedules.filter((s) => s.scheduledDate === dateStr)
                    const hasSchedule = itemsOnDate.length > 0
                    const isToday = dateStr === todayStr
                    const count = itemsOnDate.length
                    const productNames = itemsOnDate.map((s) => s.productName).filter(Boolean)
                    const itemsWithTime = itemsOnDate.map((s) => `${s.productName}${s.scheduledTime ? ` ${s.scheduledTime}` : ""}`.trim())
                    const titleText = hasSchedule
                      ? `${dateStr}: ${itemsWithTime.length ? itemsWithTime.join(" · ") : "예약 " + count + "건"}`
                      : undefined
                    return (
                      <div
                        key={dateStr}
                        className={`min-h-[3.5rem] flex flex-col items-center justify-start rounded-lg text-sm transition-all py-1 px-0.5 ${
                          hasSchedule
                            ? "bg-amber-100 text-amber-800 font-semibold ring-2 ring-amber-400/60"
                            : "text-slate-600"
                        } ${isToday ? "ring-2 ring-orange-400 ring-offset-2" : ""}`}
                        title={titleText}
                      >
                        <span className="shrink-0">{day}</span>
                        {hasSchedule && productNames.length > 0 && (
                          <div className="mt-0.5 w-full overflow-hidden text-center">
                            {count === 1 ? (
                              <span className="block text-[10px] text-amber-700 font-medium truncate px-0.5" title={productNames[0]}>
                                {productNames[0]}
                              </span>
                            ) : (
                              <>
                                <span className="block text-[10px] text-amber-700 font-medium truncate px-0.5" title={productNames[0]}>
                                  {productNames[0]}
                                </span>
                                <span className="text-[9px] text-amber-600">외 {count - 1}건</span>
                              </>
                            )}
                          </div>
                        )}
                        {hasSchedule && productNames.length === 0 && count > 0 && (
                          <span className="text-[10px] text-amber-600 mt-0.5">예약 {count}건</span>
                        )}
                      </div>
                    )
                  })
                  return (
                    <div className="grid grid-cols-7 gap-1">
                      {weekDays.map((w) => (
                        <div key={w} className="aspect-square flex items-center justify-center text-xs font-medium text-slate-500">
                          {w}
                        </div>
                      ))}
                      {blanks}
                      {days}
                    </div>
                  )
                })()}
                <p className="text-xs text-slate-500 mt-3 text-center">
                  예약이 있는 날에 예약된 영상(상품명)이 표시됩니다.
                </p>
              </div>
              {/* 공장 자동화 6단계 프로세스 스테퍼 (실제 진행 중인 예약의 phase 기준) */}
              {(() => {
                const generatingItem = factoryPipelineRunningItemId
                  ? factorySchedules.find((s) => s.id === factoryPipelineRunningItemId)
                  : factorySchedules.find((s) => s.status === "generating")
                const currentStepIndex = generatingItem ? getFactoryPhaseStepIndex(generatingItem.phase) : -1
                const steps = [
                  { step: "product", label: "제품 입력", icon: ShoppingBag },
                  { step: "script", label: "대본 및 TTS 생성", icon: FileText },
                  { step: "video", label: "이미지 생성", icon: ImageIcon },
                  { step: "render", label: "영상 생성", icon: Video },
                  { step: "thumbnail", label: "썸네일 생성", icon: ImageIcon },
                  { step: "preview", label: "완료", icon: CheckCircle2 },
                ] as const
                if (currentStepIndex < 0) return null
                return (
                  <div className="rounded-2xl border-2 border-amber-200/80 bg-white/95 p-4 md:p-6 shadow-sm">
                    <p className="text-sm font-medium text-amber-800 mb-4 text-center">
                      {generatingItem?.productName ? `진행 중: ${generatingItem.productName}` : "자동 생성 진행 중"}
                    </p>
                    <div className="flex items-center justify-center gap-1 md:gap-2 flex-wrap">
                      {steps.map((item, index) => {
                        const Icon = item.icon
                        const isActive = currentStepIndex === index
                        const isCompleted = currentStepIndex > index
                        return (
                          <div key={item.step} className="flex items-center">
                            <div className="flex flex-col items-center relative">
                              {isActive && (
                                <div className="absolute inset-0 rounded-full bg-orange-400/30 blur-xl animate-pulse" />
                              )}
                              {isCompleted && (
                                <div className="absolute inset-0 rounded-full bg-green-400/20 blur-lg" />
                              )}
                              <div
                                className={`relative w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-500 ${
                                  isActive
                                    ? "bg-orange-100 text-orange-600 scale-110 shadow-lg shadow-orange-500/50 animate-pulse"
                                    : isCompleted
                                      ? "bg-green-100 text-green-600 scale-105 shadow-md shadow-green-500/30"
                                      : "bg-slate-100 text-slate-400 border border-slate-200"
                                }`}
                              >
                                <Icon className={`w-5 h-5 md:w-6 md:h-6 ${isActive ? "animate-bounce" : ""}`} />
                                {isCompleted && (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <CheckCircle2 className="w-6 h-6 md:w-7 md:h-7 text-green-600" />
                                  </div>
                                )}
                              </div>
                              <span
                                className={`text-xs md:text-sm mt-2 text-center max-w-[4rem] md:max-w-[5rem] ${
                                  isActive ? "text-orange-600 font-semibold" : isCompleted ? "text-green-600 font-medium" : "text-slate-500"
                                }`}
                              >
                                {item.label}
                              </span>
                              {isActive && (
                                <div className="relative w-full h-1 mt-1 rounded-full bg-orange-400 animate-pulse" />
                              )}
                            </div>
                            {index < steps.length - 1 && (
                              <div className="w-4 md:w-8 h-0.5 mx-1 border-t-2 border-dashed border-slate-300" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
              {/* 예약 목록 (날짜순) */}
              <div className="grid gap-4">
                {factorySchedules.length === 0 ? (
                  <div className="text-center py-12 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50">
                    <Factory className="w-12 h-12 mx-auto text-amber-500 mb-3" />
                    <p className="text-slate-600 font-medium">예약이 없습니다</p>
                    <p className="text-sm text-slate-500 mt-1">「예약 추가」로 날짜·상품·이미지·목소리를 정해두세요.</p>
                  </div>
                ) : (
                  factorySchedules
                    .slice()
                    .sort((a, b) => {
                      const at = `${a.scheduledDate}T${a.scheduledTime || "00:00"}`
                      const bt = `${b.scheduledDate}T${b.scheduledTime || "00:00"}`
                      return at.localeCompare(bt)
                    })
                    .map((item) => {
                      const scheduledAt = `${item.scheduledDate}T${item.scheduledTime || "00:00"}`
                      const isDue = scheduledAt <= new Date().toISOString().slice(0, 16)
                      const isGenerating = item.status === "generating"
                      const isReady = item.status === "ready"
                      return (
                        <Card key={item.id} className="overflow-hidden border-amber-200/80 bg-white/90">
                          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <div
                              role="button"
                              tabIndex={0}
                              className="flex flex-1 min-w-0 items-start sm:items-center gap-4 cursor-pointer rounded-lg hover:bg-amber-50/80 transition-colors p-2 -m-2"
                              onClick={() => openFactoryItemInManualMode(item)}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFactoryItemInManualMode(item) } }}
                            >
                              <div className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                                {item.productImageBase64 ? (
                                  <img src={item.productImageBase64} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <ShoppingBag className="w-8 h-8 text-slate-400" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-900 truncate">{item.productName}</p>
                                {item.status === "generating" && item.id === factoryPipelineRunningItemId && (
                                  <p className="text-sm font-medium text-amber-700 mt-1 flex items-center gap-1.5">
                                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                                    작업 중 · {getFactoryPhaseDisplayText(item.phase)}
                                  </p>
                                )}
                                {item.status === "generating" && factoryPipelineQueue.some((q) => q.id === item.id) && item.id !== factoryPipelineRunningItemId && (
                                  <p className="text-sm font-medium text-slate-500 mt-1">
                                    대기중
                                  </p>
                                )}
                                <p className="text-sm text-slate-500 mt-0.5">
                                  발행: {new Date(item.scheduledDate + "T" + (item.scheduledTime || "00:00")).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })} {item.scheduledTime || "00:00"}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">목소리: {item.voiceId.replace("ttsmaker-", "").replace("supertone-", "수퍼톤 ").replace("elevenlabs-", "ElevenLabs ")}</p>
                                <p className="text-xs text-amber-600 mt-1">클릭하면 수동 편집</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isReady && item.youtubeUploaded && (
                                <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                                  유튜브 업로드 완료
                                </span>
                              )}
                              {isReady && !item.youtubeUploaded && youtubeChannelName && (
                                <>
                                  <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                                    유튜브 미업로드
                                  </span>
                                  <Button
                                    size="sm"
                                    className="bg-[#ff0000] hover:bg-[#cc0000] text-white"
                                    disabled={uploadingFactoryId === item.id}
                                    onClick={async () => {
                                      const blob = await getShotFormScheduleVideoBlob(item.videoBlobId || item.id)
                                      if (!blob) {
                                        alert("저장된 영상을 찾을 수 없습니다. 해당 예약을 클릭해 다시 영상을 생성해 주세요.")
                                        return
                                      }
                                      setUploadingFactoryId(item.id)
                                      try {
                                        const base64 = await new Promise<string>((resolve, reject) => {
                                          const r = new FileReader()
                                          r.onload = () => { const s = r.result as string; resolve(s.includes(",") ? s.split(",")[1] : s) }
                                          r.onerror = reject
                                          r.readAsDataURL(blob)
                                        })
                                        const [y, m, d] = item.scheduledDate.split("-").map(Number)
                                        const [h, min] = (item.scheduledTime || "09:00").split(":").map(Number)
                                        const scheduledDateTime = new Date(y, m - 1, d, h, min)
                                        const clientId = typeof window !== "undefined" ? localStorage.getItem("shopping_factory_youtube_client_id") : null
                                        const clientSecret = typeof window !== "undefined" ? localStorage.getItem("shopping_factory_youtube_client_secret") : null
                                        const res = await fetch("/api/youtube/upload", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({
                                            videoUrl: "blob:",
                                            videoBase64: base64,
                                            title: item.youtubeTitle || item.productName,
                                            description: item.youtubeDescription || "",
                                            tags: item.youtubeTags || [],
                                            scheduledTime: scheduledDateTime.toISOString(),
                                            clientId: clientId || undefined,
                                            clientSecret: clientSecret || undefined,
                                          }),
                                        })
                                        const data = await res.json().catch(() => ({}))
                                        if (res.ok && data.success) {
                                          persistFactorySchedules(factorySchedules.map((s) =>
                                            s.id === item.id ? { ...s, youtubeUploaded: true } : s
                                          ))
                                          alert(data.message || "유튜브 예약 업로드가 완료되었습니다.")
                                        } else {
                                          alert(`유튜브 업로드 실패: ${data.error || res.statusText}`)
                                        }
                                      } catch (e) {
                                        alert(`업로드 중 오류: ${e instanceof Error ? e.message : "알 수 없음"}`)
                                      } finally {
                                        setUploadingFactoryId(null)
                                      }
                                    }}
                                  >
                                    {uploadingFactoryId === item.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                                    유튜브에 업로드
                                  </Button>
                                </>
                              )}
                              {isReady && !item.youtubeUploaded && !youtubeChannelName && (
                                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                  예약 완료
                                </span>
                              )}
                              {isDue && item.status === "pending" && (
                                <Button
                                  size="sm"
                                  className="bg-amber-600 hover:bg-amber-700"
                                  disabled={isGenerating}
                                  onClick={() => startFactoryPipeline(item)}
                                >
                                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                                  {isGenerating ? "생성 중..." : "영상 생성"}
                                </Button>
                              )}
                              {item.status === "failed" && (
                                <span className="text-xs text-red-600" title={item.errorMessage || ""}>
                                  실패{item.errorMessage ? `: ${item.errorMessage}` : ""}
                                </span>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-500 hover:text-red-600"
                                onClick={() => {
                                  if (!confirm(`"${item.productName}" 예약을 삭제할까요?`)) return
                                  persistFactorySchedules(factorySchedules.filter((s) => s.id !== item.id))
                                  if (item.videoBlobId) deleteShotFormScheduleVideoBlob(item.videoBlobId).catch(() => {})
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })
                )}
              </div>
            </div>
            )}
            {/* 공장 자동화 설정 다이얼로그 (유튜브 연동) */}
            <Dialog open={showFactorySettingsDialog} onOpenChange={setShowFactorySettingsDialog}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>공장 자동화 설정</DialogTitle>
                  <DialogDescription>
                    예약 발행 시 유튜브 쇼츠 자동 업로드를 위해 채널을 연동할 수 있습니다.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label className="text-amber-900 font-medium">YouTube API 설정</Label>
                    <p className="text-sm text-slate-600">Google Cloud Console에서 OAuth 2.0 클라이언트 ID(웹 애플리케이션)를 만든 뒤 아래에 입력하세요.</p>
                    <div className="grid gap-2">
                      <Label className="text-xs text-slate-500">Client ID</Label>
                      <Input
                        type="text"
                        placeholder="xxxxx.apps.googleusercontent.com"
                        value={youtubeClientId}
                        onChange={(e) => setYoutubeClientId(e.target.value)}
                        onBlur={() => {
                          try {
                            if (typeof window !== "undefined" && youtubeClientId.trim())
                              localStorage.setItem("shopping_factory_youtube_client_id", youtubeClientId.trim())
                          } catch (_) {}
                        }}
                        className="font-mono text-sm"
                      />
                      <Label className="text-xs text-slate-500">Client Secret</Label>
                      <Input
                        type="password"
                        placeholder="GOCSPX-..."
                        value={youtubeClientSecret}
                        onChange={(e) => setYoutubeClientSecret(e.target.value)}
                        onBlur={() => {
                          try {
                            if (typeof window !== "undefined" && youtubeClientSecret)
                              localStorage.setItem("shopping_factory_youtube_client_secret", youtubeClientSecret)
                          } catch (_) {}
                        }}
                        className="font-mono text-sm"
                      />
                    </div>
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1">
                      <strong>redirect_uri_mismatch 오류 시:</strong> Google Cloud Console → 사용자 인증 정보 → 해당 OAuth 클라이언트 → &quot;승인된 리디렉션 URI&quot;에 아래 주소를 <strong>그대로</strong> 추가하세요.
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-slate-100 px-2 py-1 rounded break-all flex-1">
                        {typeof window !== "undefined" ? `${window.location.origin}/api/youtube/callback` : "https://도메인/api/youtube/callback"}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 h-8"
                        onClick={() => {
                          const uri = typeof window !== "undefined" ? `${window.location.origin}/api/youtube/callback` : ""
                          if (uri && navigator.clipboard) {
                            navigator.clipboard.writeText(uri)
                            alert("리디렉션 URI가 클립보드에 복사되었습니다.")
                          }
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-amber-900 font-medium">YouTube 연동</Label>
                    {youtubeChannelName ? (
                      <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
                        <p className="text-sm text-amber-800">
                          연결된 채널: <span className="font-semibold">{youtubeChannelName}</span>
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-amber-300 text-amber-700 hover:bg-amber-100"
                          onClick={() => {
                            const key = "shopping_factory_youtube_channel"
                            try {
                              if (typeof window !== "undefined") localStorage.removeItem(key)
                            } catch (_) {}
                            setYoutubeChannelName(null)
                            setShowFactorySettingsDialog(false)
                          }}
                        >
                          연동 해제
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <p className="text-sm text-slate-600">YouTube 채널과 연동하면 예약 발행 시 해당 채널에 자동 업로드할 수 있습니다.</p>
                        <Button
                          type="button"
                          className="bg-[#ff0000] hover:bg-[#cc0000] text-white"
                          onClick={async () => {
                            const id = youtubeClientId.trim()
                            const secret = youtubeClientSecret
                            if (typeof window === "undefined") return
                            if (id && secret) {
                              try {
                                const res = await fetch("/api/youtube/auth", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ clientId: id, clientSecret: secret, state: "shopping_factory" }),
                                })
                                if (res.redirected && res.url) {
                                  window.location.href = res.url
                                  return
                                }
                                const data = await res.json().catch(() => ({}))
                                if (data.url) {
                                  window.location.href = data.url
                                  return
                                }
                                if (!res.ok) {
                                  alert(data.error || "연동 시작에 실패했습니다.")
                                  return
                                }
                              } catch (e) {
                                alert("연동 요청 중 오류가 발생했습니다.")
                                return
                              }
                            }
                            window.location.href = "/api/youtube/auth?state=shopping_factory"
                          }}
                        >
                          YouTube 채널과 연동
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            {/* 공장 자동화 - 예약 추가 다이얼로그 (공장 탭에서도 열리도록 showProjectList일 때 항상 렌더) */}
            <Dialog open={showAddFactoryScheduleDialog} onOpenChange={setShowAddFactoryScheduleDialog}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>예약 추가</DialogTitle>
                  <DialogDescription>
                    발행일·상품명·이미지·목소리를 정해두면 해당 날에 영상을 자동 생성할 수 있습니다.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>발행일</Label>
                    <Input type="date" value={newFactoryDate} onChange={(e) => setNewFactoryDate(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>발행 시간 (시·분)</Label>
                    <Input type="time" value={newFactoryTime} onChange={(e) => setNewFactoryTime(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>상품명</Label>
                    <Input placeholder="상품명" value={newFactoryName} onChange={(e) => setNewFactoryName(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>상품 설명 (선택)</Label>
                    <Textarea placeholder="상품 설명" value={newFactoryDesc} onChange={(e) => setNewFactoryDesc(e.target.value)} rows={2} className="resize-none" />
                  </div>
                  <div className="grid gap-2">
                    <Label>상품 이미지</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        className="flex-1"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = () => {
                            let data = reader.result as string
                            const img = new Image()
                            img.onload = () => {
                              const max = 400
                              if (img.width <= max && img.height <= max) {
                                setNewFactoryImage(data)
                                return
                              }
                              const c = document.createElement("canvas")
                              const r = Math.min(max / img.width, max / img.height)
                              c.width = img.width * r
                              c.height = img.height * r
                              const ctx = c.getContext("2d")
                              if (ctx) {
                                ctx.drawImage(img, 0, 0, c.width, c.height)
                                setNewFactoryImage(c.toDataURL("image/jpeg", 0.85))
                              } else setNewFactoryImage(data)
                            }
                            img.src = data
                          }
                          reader.readAsDataURL(file)
                        }}
                      />
                      {newFactoryImage && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setNewFactoryImage(null)} className="text-red-500">
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    {newFactoryImage && <img src={newFactoryImage} alt="" className="mt-2 w-20 h-20 object-cover rounded-lg border" />}
                  </div>
                  <div className="grid gap-2">
                    <Label>목소리</Label>
                    <Select value={newFactoryVoiceId} onValueChange={setNewFactoryVoiceId}>
                      <SelectTrigger>
                        <SelectValue placeholder="목소리 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ttsmaker-여성1">TTSMaker 여성1</SelectItem>
                        <SelectItem value="ttsmaker-여성2">TTSMaker 여성2</SelectItem>
                        <SelectItem value="ttsmaker-여성6">TTSMaker 여성3</SelectItem>
                        <SelectItem value="ttsmaker-남성1">TTSMaker 남성1</SelectItem>
                        <SelectItem value="ttsmaker-남성4">TTSMaker 남성2</SelectItem>
                        <SelectItem value="ttsmaker-남성5">TTSMaker 남성3</SelectItem>
                        {supertoneVoices.map((v) => (
                          <SelectItem key={v.voice_id} value={`supertone-${v.voice_id}`}>
                            수퍼톤 {v.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="elevenlabs-jB1Cifc2UQbq1gR3wnb0">ElevenLabs Rachel</SelectItem>
                        <SelectItem value="elevenlabs-8jHHF8rMqMlg8if2mOUe">ElevenLabs Voice 2</SelectItem>
                        <SelectItem value="elevenlabs-uyVNoMrnUku1dZyVEXwD">ElevenLabs Voice 3</SelectItem>
                        <SelectItem value="elevenlabs-1KNqBv4TutQtzSIACsMC">ElevenLabs Voice 4</SelectItem>
                        <SelectItem value="elevenlabs-4JJwo477JUAx3HV0T7n7">ElevenLabs Voice 5</SelectItem>
                      </SelectContent>
                    </Select>
                    {supertoneVoices.length === 0 && (
                      <p className="text-xs text-slate-500">수퍼톤 목소리는 대본/TTS 단계에서 한 번 진입하면 목록이 불러와집니다.</p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddFactoryScheduleDialog(false)}>취소</Button>
                  <Button
                    onClick={() => {
                      if (!newFactoryDate || !newFactoryName.trim()) {
                        alert("발행일과 상품명을 입력해주세요.")
                        return
                      }
                      const newItem: FactoryScheduleItem = {
                        id: `factory_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                        scheduledDate: newFactoryDate,
                        scheduledTime: newFactoryTime,
                        productName: newFactoryName.trim(),
                        productDescription: newFactoryDesc.trim() || undefined,
                        productImageBase64: newFactoryImage,
                        voiceId: newFactoryVoiceId,
                        status: "generating",
                        phase: "product",
                        createdAt: new Date().toISOString(),
                      }
                      const nextList = [...factorySchedules, newItem]
                      persistFactorySchedules(nextList)
                      setShowAddFactoryScheduleDialog(false)
                      setNewFactoryDate("")
                      setNewFactoryTime("09:00")
                      setNewFactoryName("")
                      setNewFactoryDesc("")
                      setNewFactoryImage(null)
                      setNewFactoryVoiceId("ttsmaker-여성1")
                      // 순차 처리: 큐에 넣기만 하고, 별도 useEffect에서 한 건씩 처리
                      setFactoryPipelineQueue((prev) => [...prev, newItem])
                    }}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    추가
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <>
            {renderStepContent()}
            {/* 프로젝트 목록 및 저장 버튼 */}
            <div className="fixed top-6 right-6 z-40 flex items-center gap-3">
              <Button
                onClick={() => {
                  if (currentProject) {
                    saveProject()
                  } else {
                    setShowCreateProjectDialog(true)
                    setNewProjectName("")
                    setNewProjectDescription("")
                  }
                }}
                disabled={isSavingProject || !currentProject}
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-semibold shadow-lg shadow-orange-500/50 disabled:opacity-50 border-orange-200/50 backdrop-blur-xl"
              >
                {isSavingProject ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    프로젝트 저장
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowProjectList(true)
                }}
                className="border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 backdrop-blur-xl text-orange-700 hover:from-orange-100 hover:to-amber-100 hover:text-orange-800 hover:border-orange-400 font-semibold shadow-lg transition-all"
              >
                <Home className="w-4 h-4 mr-2" />
                프로젝트 목록
              </Button>
            </div>
          </>
        )}
        
        {/* 숨겨진 Canvas (렌더링용) */}
        <canvas
          ref={canvasRef}
          width={1080}
          height={1920}
          className="hidden"
          style={{ width: "1080px", height: "1920px" }}
        />
      </div>

      {/* 네이버 인기 키워드 다이얼로그 */}
      <Dialog open={showKeywordsDialog} onOpenChange={setShowKeywordsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] bg-white/95 backdrop-blur-xl border-2 border-orange-200/50 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-orange-500" />
              현재 잘뜨는 키워드
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              네이버 데이터랩에서 최근 7일간 인기 검색 키워드를 가져왔습니다. 키워드를 클릭하면 제품명에 자동으로 입력됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
            {isLoadingKeywords ? (
              <div className="flex flex-col items-center justify-center py-16">
                {/* AI가 키워드를 찾는 애니메이션 */}
                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-r from-orange-200 to-amber-200 animate-pulse"></div>
                  </div>
                  <div className="relative flex items-center justify-center">
                    <Sparkles className="w-12 h-12 text-orange-500 animate-bounce" style={{ animationDelay: '0s' }} />
                    <Sparkles className="w-8 h-8 text-amber-500 animate-bounce absolute -top-2 -left-2" style={{ animationDelay: '0.2s' }} />
                    <Sparkles className="w-6 h-6 text-orange-400 animate-bounce absolute -bottom-1 -right-1" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
                <div className="space-y-2 text-center">
                  <p className="text-lg font-semibold text-slate-800 bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                    AI가 인기 키워드를 분석 중...
                  </p>
                  <div className="flex items-center justify-center gap-1">
                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                    <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                  </div>
                  <p className="text-sm text-slate-500 mt-4">최신 트렌드를 찾고 있어요</p>
                </div>
              </div>
            ) : trendingKeywords.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 py-4">
                {trendingKeywords.map((keyword, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200/50 hover:border-orange-400 hover:from-orange-100 hover:to-amber-100 transition-all duration-200 group shadow-sm hover:shadow-md cursor-pointer"
                    onClick={() => handleSelectKeyword(keyword)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                        #{index + 1}
                      </span>
                      <Sparkles className="w-4 h-4 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-orange-600 transition-colors mb-3">
                      {keyword}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelectKeyword(keyword)
                        }}
                        className="flex-1 px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-lg transition-all shadow-sm hover:shadow-md"
                      >
                        선택
                      </button>
                      <a
                        href={`https://www.coupang.com/np/search?q=${encodeURIComponent(keyword)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 px-3 py-1.5 text-xs font-semibold bg-white border-2 border-orange-300 hover:border-orange-400 text-orange-600 hover:text-orange-700 rounded-lg transition-all shadow-sm hover:shadow-md text-center"
                      >
                        쿠팡 검색
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-slate-500">인기 키워드를 불러올 수 없습니다.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowKeywordsDialog(false)}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 윙스봇 챗봇 */}
      {!isChatbotOpen && (
        <button
          onClick={() => {
            setIsChatbotOpen(true)
            if (chatbotMessages.length === 0) {
              setChatbotMessages([{
                type: "assistant",
                content: "안녕하세요! 윙스봇입니다. 무엇을 도와드릴까요?"
              }])
            }
          }}
          className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-50 group"
          title="윙스봇과 대화하기"
        >
          <Bot className="w-8 h-8 group-hover:scale-110 transition-transform" />
        </button>
      )}

      {isChatbotOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-xl shadow-2xl border-2 border-gray-200 flex flex-col z-50">
          {/* 챗봇 헤더 */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 rounded-t-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-6 h-6" />
              <h3 className="font-bold text-lg">윙스봇</h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={() => setIsChatbotOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {chatbotMessages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.type === "user"
                      ? "bg-orange-500 text-white"
                      : "bg-white text-gray-900 border border-gray-200"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {isChatbotGenerating && (
              <div className="flex justify-start">
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                    <span className="text-sm text-gray-500">응답 생성 중...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 입력 영역 */}
          <div className="p-4 border-t border-gray-200 bg-white rounded-b-xl">
            <div className="flex gap-2">
              <Textarea
                placeholder="메시지를 입력하세요..."
                value={chatbotInput}
                onChange={(e) => setChatbotInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleChatbotSend()
                  }
                }}
                className="flex-1 min-h-[60px] max-h-[120px] resize-none"
                disabled={isChatbotGenerating}
              />
              <Button
                onClick={handleChatbotSend}
                disabled={!chatbotInput.trim() || isChatbotGenerating}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
              >
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 오디오 라이브러리 다이얼로그 - 항상 렌더링 */}
      {/* BGM 라이브러리 다이얼로그 */}
      <Dialog open={showBgmLibraryDialog} onOpenChange={(open) => {
        console.log("[Shopping] BGM 다이얼로그 onOpenChange 호출됨:", open, "현재 상태:", showBgmLibraryDialog)
        // 디버깅: 왜 false로 변경되는지 확인
        if (!open && showBgmLibraryDialog) {
          console.log("[Shopping] ⚠️ 다이얼로그가 열려있는데 닫기 요청이 들어옴!")
          console.trace("[Shopping] 스택 트레이스:")
        }
        setShowBgmLibraryDialog(open)
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>BGM 라이브러리</DialogTitle>
            <DialogDescription>
              관리자가 업로드한 BGM 중에서 선택하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {isLoadingAudioLibrary ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                <span className="ml-2 text-sm text-slate-600">라이브러리 로딩 중...</span>
              </div>
            ) : bgmLibrary.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p>등록된 BGM이 없습니다.</p>
                <p className="text-xs mt-2">관리자에게 문의하세요.</p>
                <p className="text-xs mt-1">로드된 BGM 개수: {bgmLibrary.length}</p>
              </div>
            ) : (
              bgmLibrary.map((audio) => (
                <div
                  key={audio.path}
                  className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => handleSelectBgmFromLibrary(audio)}
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{audio.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{audio.path}</p>
                  </div>
                  <audio controls className="flex-1 h-8" src={audio.url} />
                  <Button size="sm" variant="outline">
                    선택
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 효과음 라이브러리 다이얼로그 */}
      <Dialog open={showSfxLibraryDialog} onOpenChange={(open) => {
        console.log("[Shopping] 효과음 다이얼로그 onOpenChange 호출됨:", open, "현재 상태:", showSfxLibraryDialog)
        // 디버깅: 왜 false로 변경되는지 확인
        if (!open && showSfxLibraryDialog) {
          console.log("[Shopping] ⚠️ 다이얼로그가 열려있는데 닫기 요청이 들어옴!")
          console.trace("[Shopping] 스택 트레이스:")
        }
        setShowSfxLibraryDialog(open)
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>효과음 라이브러리</DialogTitle>
            <DialogDescription>
              관리자가 업로드한 효과음 중에서 선택하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {isLoadingAudioLibrary ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-2 text-sm text-slate-600">라이브러리 로딩 중...</span>
              </div>
            ) : sfxLibrary.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p>등록된 효과음이 없습니다.</p>
                <p className="text-xs mt-2">관리자에게 문의하세요.</p>
                <p className="text-xs mt-1">로드된 효과음 개수: {sfxLibrary.length}</p>
              </div>
            ) : (
              sfxLibrary.map((audio) => (
                <div
                  key={audio.path}
                  className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => handleSelectSfxFromLibrary(audio)}
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{audio.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{audio.path}</p>
                  </div>
                  <audio controls className="flex-1 h-8" src={audio.url} />
                  <Button size="sm" variant="outline">
                    선택
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 예약 발행 모달 (ShotForm 쇼핑) */}
      <Dialog open={scheduleModalOpen} onOpenChange={setScheduleModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>예약 발행</DialogTitle>
            <DialogDescription>
              영상을 미리 생성해 두고, 선택한 날짜·시간이 되면 예약 목록에서 다운로드할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="schedule-date">발행 날짜</Label>
              <Input
                id="schedule-date"
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="schedule-time">발행 시간</Label>
              <Input
                id="schedule-time"
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </div>
            {productName && (
              <p className="text-sm text-muted-foreground">
                제품: <span className="font-medium text-foreground">{productName}</span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleModalOpen(false)} disabled={isScheduling}>
              취소
            </Button>
            <Button
              onClick={handleConfirmSchedule}
              disabled={isScheduling || !scheduleDate || !scheduleTime}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isScheduling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  영상 생성 및 예약 중...
                </>
              ) : (
                <>
                  <CalendarClock className="w-4 h-4 mr-2" />
                  예약하기
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}



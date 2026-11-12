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
  CalendarPlus,
  PawPrint,
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
import { generateShoppingScript, generateVideoWithSora2, generateImagesWith3Scenes, splitScriptIntoScenes, convertImageToVideoWithWan, convertImagesToVideosWithScript, generateImage, generateImageWithNanobanana, generateVideoWithSeedance, generateShortsThumbnail, generateThumbnailHookingText, generateYouTubeMetadata, getNaverTrendingKeywords, analyzeScriptParts, generateImagePromptsFromScript, refineImagePromptWithCustomInput, mergeVideos, generateVideoPromptFromScript, generateVideoPromptFor3Scenes, generateVideoPromptForImage, generateCharacterReferenceImage } from "./actions"
import { getApiKey } from "@/lib/api-keys"
import { getShoppingProjects, createShoppingProject, updateShoppingProject, deleteShoppingProject, getShoppingProject, uploadTTSAudio, type ShoppingProject, type ShoppingProjectData } from "./project-actions"
import { getAudioLibrary, getAllAudioLibrary, type AudioLibraryItem } from "./audio-library-actions"
import {
  ANIMAL_CHARACTER_PRESETS,
  buildCustomVisualPromptEn,
  createCharacterFromPreset,
  createDefaultAnimalCharacter,
  type AnimalCharacter,
  type AnimalSpecies,
} from "./animal-character"
import { AnimalCoupangSearchPanel } from "./AnimalCoupangSearchPanel"
import { AnimalVoicePanel } from "./AnimalVoicePanel"
import { AnimalCapCutEditWorkspace, type AnimalSubtitleStyle } from "./AnimalCapCutEditWorkspace"
import type { CoupangRankedProduct } from "@/lib/shotform-keyword-analysis-types"
import { Plus, Trash2, Edit2, Search, FolderOpen, Factory, Cog, ChevronLeft, ChevronRight, Settings } from "lucide-react"
import "./animal-shopping-theme.css"

const DEFAULT_ANIMAL_SUBTITLE_STYLE: AnimalSubtitleStyle = {
  fontSize: 48,
  fontFamily: "Pretendard",
  color: "#FFFFFF",
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  position: "center",
  positionOffset: 0,
  textAlign: "center",
  fontWeight: "bold",
  textShadow: true,
  outlineEnabled: true,
  outlineWidth: 8,
  outlineColor: "#000000",
  shadowEnabled: true,
  shadowColor: "#000000",
  shadowDistance: 12,
  shadowAngle: -45,
  horizontalPercent: 50,
  verticalPercent: 50,
}

// AudioBuffer�?WAV�?변?�하???�수
const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
  const length = buffer.length
  const numberOfChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2)
  const view = new DataView(arrayBuffer)
  const channels: Float32Array[] = []
  let offset = 0
  let pos = 0

  // WAV ?�더 ?�성
  const setUint16 = (data: number) => {
    view.setUint16(pos, data, true)
    pos += 2
  }
  const setUint32 = (data: number) => {
    view.setUint32(pos, data, true)
    pos += 4
  }

  // RIFF ?�더
  setUint32(0x46464952) // "RIFF"
  setUint32(length * numberOfChannels * 2 + 36) // ?�일 ?�기 - 8
  setUint32(0x45564157) // "WAVE"

  // fmt �?��
  setUint32(0x20746d66) // "fmt "
  setUint32(16) // �?�� ?�기
  setUint16(1) // ?�디???�맷 (1 = PCM)
  setUint16(numberOfChannels) // 채널 ??  setUint32(sampleRate) // ?�플?�이??  setUint32(sampleRate * numberOfChannels * 2) // 바이???�이??  setUint16(numberOfChannels * 2) // 블록 ?�렬
  setUint16(16) // 비트 깊이

  // data �?��
  setUint32(0x61746164) // "data"
  setUint32(length * numberOfChannels * 2) // ?�이???�기

  // 채널 ?�이??가?�오�?  for (let i = 0; i < numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i))
  }

  // PCM ?�이???�성
  // �??�플???�회?�면??모든 채널???�이?��? ?�터리브 ?�식?�로 ?�성
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      let sample = Math.max(-1, Math.min(1, channels[channel][i]))
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(pos, sample, true)
      pos += 2
    }
  }

  console.log("[Shopping] WAV 변???�료:", {
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

// ?�약 발행 (ShotForm ?�핑 ?�용)
const SHOTFORM_SCHEDULES_STORAGE_KEY = "wings_shotform_animal_shopping_schedules"
const SHOTFORM_SCHEDULES_DB_NAME = "WingsShotFormAnimalShoppingSchedules"
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

// ?�동??모드 (공장 모드): ?�짜�??�품·?��?지·목소리만 ?�해?�면 ?�당 ?�에 ?�상 ?�동 ?�성
const FACTORY_SCHEDULES_STORAGE_KEY = "wings_shotform_animal_shopping_factory_schedules"

export interface FactoryScheduleItem {
  id: string
  scheduledDate: string // YYYY-MM-DD
  scheduledTime?: string // HH:mm (발행 ?�·분)
  productName: string
  productDescription?: string
  productImageBase64: string | null // ?�네?�용 ?��? base64 가??  voiceId: string // selectedVoiceId ?�식 (ttsmaker-?�성1, supertone-xxx ??
  status: "pending" | "generating" | "ready" | "failed"
  phase?: string // ?�행 ?�계: product | script | video | render | thumbnail | preview
  createdAt: string
  errorMessage?: string
  videoBlobId?: string // ready????ShotForm schedule ID?� ?�일?�게 ?�용 가??  projectId?: string // ?�동??모드 ?�동 ?�성 ???�성·?�?�되???�로?�트 ID
  /** ?�약 ?�료 ???�튜�??�로?�에 ?�용 (?�목/?�명/?�그 ?�성�?�? */
  youtubeTitle?: string
  youtubeDescription?: string
  youtubeTags?: string[]
  /** ?�동??모드?�서 ?�동 ?�로???�료??경우 true (목록?�서 ?�운로드 버튼 ?�???�튜�??�로???�료 ?�시) */
  youtubeUploaded?: boolean
}

const FACTORY_PHASE_LABELS: Record<string, string> = {
  product: "?�품 ?�력",
  script: "?�본·TTS ?�성",
  video: "?��?지 ?�성",
  render: "?�상 ?�성",
  thumbnail: "?�네???�성",
  preview: "미리보기·?�더�?,
}

// ?�동??모드 ?�계 ?�서 �??�계�??�름 (?�료/진행 �??�시??
const FACTORY_PHASES_ORDER: Array<{ key: string; label: string }> = [
  { key: "script", label: "?�본생?? },
  { key: "video", label: "?��?지?�성" },
  { key: "tts", label: "TTS?�성" },
  { key: "render", label: "?�상?�성" },
  { key: "preview", label: "미리보기" },
]

function getFactoryPhaseDisplayText(phase: string | undefined): string {
  if (!phase) return "진행 �?
  const idx = FACTORY_PHASES_ORDER.findIndex((p) => p.key === phase)
  if (idx < 0) return FACTORY_PHASE_LABELS[phase] || phase
  const parts: string[] = []
  for (let i = 0; i < FACTORY_PHASES_ORDER.length; i++) {
    if (i < idx) parts.push(`${FACTORY_PHASES_ORDER[i].label} ?�료`)
    else if (i === idx) parts.push(`${FACTORY_PHASES_ORDER[i].label} �?)
    else break
  }
  return parts.join(" ??")
}

// ?�막: ?�어 중간?�서 ?��? ?�고, 공백 ?�위�?묶어????줄씩 ?�시 (?? "?�거 ?�나�??�리가" / "진짜 ?�워?�요")
const SUBTITLE_MAX_CHARS_PER_LINE = 11

// "??거예?? ??"?�거?�요"처럼 ?�어?�기???��?/보조?�언?????�위�?묶음 (�??�눔 ??"?? / "거예??�??�기지 ?�도�?
function mergeKoreanEndingSpaces(text: string): string {
  return text
    .replace(/\s+(거예??거야|�?같아|???�어|???�죠|겁니???�니???�요|?�요|?�죠|?�까??\b/g, (m) => m.trim())
    .replace(/\s+(거예??거야)\s*$/g, (m) => m.trim())
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

// ?�동??모드 6?�계 ?�테?�용: phase ???�텝 ?�덱??(0=?�품?�력, 1=?�본·TTS, 2=?��?지, 3=?�상, 4=?�네?? 5=?�료)
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

export default function AnimalShoppingPage() {
  const shoppingBrandLabel = "AI ?�물 ?�핑 ?�폼"
  const [animalCharacter, setAnimalCharacter] = useState<AnimalCharacter>(() => createDefaultAnimalCharacter())
  const [isGeneratingCharacterRef, setIsGeneratingCharacterRef] = useState(false)
  const [productName, setProductName] = useState("")
  const [productDescription, setProductDescription] = useState("")
  const [productImage, setProductImage] = useState<string | null>(null)
  const [productImageFile, setProductImageFile] = useState<File | null>(null)
  const [productImageAspectRatio, setProductImageAspectRatio] = useState<number | null>(null) // ?�품 ?��?지 비율 (width/height)
  const [coupangSearchQuery, setCoupangSearchQuery] = useState("")
  const [coupangProducts, setCoupangProducts] = useState<CoupangRankedProduct[]>([])
  const [selectedCoupangProduct, setSelectedCoupangProduct] = useState<CoupangRankedProduct | null>(null)
  const [isSearchingCoupang, setIsSearchingCoupang] = useState(false)
  const [coupangSearchError, setCoupangSearchError] = useState("")
  const [coupangUrl, setCoupangUrl] = useState("")
  const [script, setScript] = useState("")
  const [videoUrl, setVideoUrl] = useState<string>("")
  const [imageUrls, setImageUrls] = useState<string[]>([]) // 3�??�면 ?��?지 URL 배열
  const [convertedVideoUrls, setConvertedVideoUrls] = useState<Map<number, string>>(new Map()) // �??�면별로 변?�된 ?�상 URL ?�??  const [imagePrompts, setImagePrompts] = useState<Array<{ type: string; prompt: string; description: string; scriptText: string }>>([]) // ?��?지 ?�롬?�트 배열
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false) // ?�롬?�트 ?�성 �??��?
  const [promptsGenerated, setPromptsGenerated] = useState(false) // ?�롬?�트 ?�성 ?�료 ?��?
  const [videoPrompts, setVideoPrompts] = useState<Map<number, string>>(new Map()) // �??�면�??�상 ?�롬?�트 ?�??(?�덱??-> ?�롬?�트)
  const [isGeneratingVideoPrompts, setIsGeneratingVideoPrompts] = useState<Map<number, boolean>>(new Map()) // �??�면�??�상 ?�롬?�트 ?�성 �??��?
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [isConvertingToVideo, setIsConvertingToVideo] = useState<Map<number, boolean>>(new Map()) // �??�면�?변??�??��?
  const [isRegeneratingImage, setIsRegeneratingImage] = useState<Map<number, boolean>>(new Map()) // �??��?지�??�생??�??��?
  const [customImagePrompts, setCustomImagePrompts] = useState<Map<number, string>>(new Map()) // �??��?지�?추�? ?�롬?�트 (?�국??
  const [isMergingVideos, setIsMergingVideos] = useState(false) // ?�상 ?�치�?�??��?
  const [activeStep, setActiveStep] = useState<"product" | "script" | "video" | "render" | "thumbnail" | "preview">("product")
  const [error, setError] = useState<string>("")
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number }>({ current: 0, total: 3 })
  
  // TTS �??�상 ?�더�?관???�태
  const [scenes, setScenes] = useState<string[]>([]) // 3�??�면 ?�스??  const [scriptLines, setScriptLines] = useState<ScriptLine[]>([]) // ?�막???�인
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string>("")
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false)
  const [ttsProgress, setTtsProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 })
  const [isRendering, setIsRendering] = useState(false)
  const [isServerDownloading, setIsServerDownloading] = useState(false) // ?�버 ?�운로드(Cloud Run ?�더) �?  /** 모바???�앱?�서 ?�동 ?�운로드가 ??????보여�?'?�상 ?�?? 링크 (??��???�?? */
  const [serverDownloadLink, setServerDownloadLink] = useState<{ url: string; fileName: string } | null>(null)
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false) // 미리보기 ?�성 �??�태
  const [previewGenerated, setPreviewGenerated] = useState(false) // 미리보기 ?�성 ?�료 ?��?
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("elevenlabs-jB1Cifc2UQbq1gR3wnb0")
  const [ttsSpeed, setTtsSpeed] = useState(1.05)
  const [customElevenLabsVoices, setCustomElevenLabsVoices] = useState<Array<{ id: string; name: string }>>([]) // ?�용??추�? ?�레븐랩??목소�?  const [supertoneVoices, setSupertoneVoices] = useState<Array<{ voice_id: string; name: string; language: string[]; styles: string[]; thumbnail_image_url?: string }>>([]) // ?�퍼???�성 목록
  const [isLoadingSupertoneVoices, setIsLoadingSupertoneVoices] = useState(false) // ?�퍼???�성 목록 로딩 �?  const [selectedSupertoneVoiceId, setSelectedSupertoneVoiceId] = useState<string>("") // ?�택???�퍼???�성 ID
  const [selectedSupertoneStyle, setSelectedSupertoneStyle] = useState<string>("neutral") // ?�택???�퍼???��???/ typecast emotion
  const [customElevenLabsVoiceId, setCustomElevenLabsVoiceId] = useState<string>("") // ?�용?��? ?�력??ElevenLabs ?�성 ID
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null)
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null)
  const [previewVideoElements, setPreviewVideoElements] = useState<HTMLVideoElement[]>([]) // 미리보기??비디???�리먼트
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null) // 미리보기???�디??  const [previewBgmAudio, setPreviewBgmAudio] = useState<HTMLAudioElement | null>(null) // 미리보기??BGM ?�디??  const [previewSfxAudio, setPreviewSfxAudio] = useState<HTMLAudioElement | null>(null) // 미리보기???�과???�디??  const [previewAnimationFrame, setPreviewAnimationFrame] = useState<number | null>(null) // 미리보기 ?�니메이???�레??(?�용 ???? 롱폼 방식)
  const [previewThumbnailImage, setPreviewThumbnailImage] = useState<HTMLImageElement | null>(null) // 미리보기???�네???��?지
  const [currentSubtitle, setCurrentSubtitle] = useState<string>("") // ?�재 ?�막 (롱폼 방식)
  const previewVideoRef = useRef<HTMLVideoElement | null>(null) // 미리보기??비디??ref (롱폼 방식)
  const [currentVideoIndex, setCurrentVideoIndex] = useState<number>(-1) // ?�재 ?�생 중인 ?�상 ?�덱??  const [previousVideoIndex, setPreviousVideoIndex] = useState<number>(-1) // ?�전 ?�생 중인 ?�상 ?�덱??  const [videoTransitionOpacity, setVideoTransitionOpacity] = useState<number>(1) // ?�상 ?�환 ?�과??opacity
  
  // Canvas �?미리보기 관??  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const previewContainerRef = useRef<HTMLDivElement | null>(null)
  
  // ?�네???�성�?관??  const [thumbnailUrl, setThumbnailUrl] = useState<string>("")
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false)
  const [thumbnailHookingText, setThumbnailHookingText] = useState<{ line1: string; line2: string }>({ line1: "", line2: "" })
  const thumbnailCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [draggingBgmHandle, setDraggingBgmHandle] = useState<"start" | "end" | null>(null) // BGM ?�들 ?�래�?�?
  // ?�약 발행 (ShotForm ?�핑)
  const [scheduledItems, setScheduledItems] = useState<ShoppingScheduleItem[]>([])
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [scheduleDate, setScheduleDate] = useState("")
  const [scheduleTime, setScheduleTime] = useState("09:00")
  const [isScheduling, setIsScheduling] = useState(false)
  const [draggingSfxHandle, setDraggingSfxHandle] = useState<"start" | "end" | null>(null) // ?�과???�들 ?�래�?�?  const timelineRef = useRef<HTMLDivElement | null>(null) // ?�?�라???�생�?ref
  const bgmTimelineRef = useRef<HTMLDivElement | null>(null) // BGM ?�?�라??ref
  const sfxTimelineRef = useRef<HTMLDivElement | null>(null) // ?�과???�?�라??ref
  const [thumbnailMode, setThumbnailMode] = useState<"ai" | "manual">("ai") // AI ?�성 ?�는 직접 ?�성
  const [thumbnailImages, setThumbnailImages] = useState<Array<{ url: string; text: { line1: string; line2: string }; isCustom: boolean }>>([]) // ?�러 ?�네???�??  const [selectedThumbnailIndex, setSelectedThumbnailIndex] = useState<number>(-1) // ?�택???�네???�덱??  const [customThumbnailImage, setCustomThumbnailImage] = useState<string>("") // 직접 ?�로?�한 ?��?지
  const [customThumbnailText, setCustomThumbnailText] = useState<{ line1: string; line2: string }>({ line1: "", line2: "" }) // 직접 ?�성???�네?�의 ?�스??  const [customThumbnailTextStyle, setCustomThumbnailTextStyle] = useState<{
    line1Color: string
    line2Color: string
    fontSize: number // 글???�기 (48 ~ 200)
    position: number // 0.0 ~ 1.0 (0 = ?�단, 0.5 = 중앙, 1.0 = ?�단)
    strokeWidth: number // ?�두�??�께
    strokeColor: string // ?�두�??�상
    imageScale: number // ?��?지 ?��?/축소 (0.5 ~ 2.0)
    textRotation: number // ?�스???�전 각도 (???�위, -180 ~ 180)
  }>({
    line1Color: "#FFFFFF", // ?�색
    line2Color: "#00FFCC", // 민트??    fontSize: 100, // 글???�기 (기본 100px)
    position: 0.45, // 중앙 ?�간 ??    strokeWidth: 4,
    strokeColor: "#000000", // 검?�색 ?�두�?    imageScale: 1.0, // 기본 100%
    textRotation: 0 // 기본 ?�전 ?�음
  })

  // ?�로??기능 관???�태
  const [videoDuration, setVideoDuration] = useState<12 | 15 | 20 | 30>(12) // ?�상 길이 ?�션
  const [isEditingScript, setIsEditingScript] = useState(false) // ?��??�집 모드
  const [editedScript, setEditedScript] = useState("") // ?�집???��?  const [scriptParts, setScriptParts] = useState<Array<{ part: string; text: string; startIndex: number; endIndex: number }>>([]) // ?��??�트 분석 결과
  const [isAnalyzingScript, setIsAnalyzingScript] = useState(false) // ?��?분석 �??��?
  
  // ?�막 ?��????�정
  const [subtitleStyle, setSubtitleStyle] = useState<AnimalSubtitleStyle>({ ...DEFAULT_ANIMAL_SUBTITLE_STYLE })
  const [editInspectorTab, setEditInspectorTab] = useState<"subtitle" | "audio" | "meta">("subtitle")
  
  // BGM 관???�태
  const [bgmUrl, setBgmUrl] = useState<string>("")
  const [bgmFile, setBgmFile] = useState<File | null>(null)
  const [bgmVolume, setBgmVolume] = useState(0.3) // BGM 볼륨 (0-1)
  const [bgmStartTime, setBgmStartTime] = useState(0) // BGM ?�작 ?�간 (�?
  const [bgmEndTime, setBgmEndTime] = useState(0) // BGM 종료 ?�간 (�?
  const [ttsVolume, setTtsVolume] = useState(1.0) // TTS 볼륨 (0-1)
  
  // ?�과??관???�태
  const [sfxUrl, setSfxUrl] = useState<string>("")
  const [sfxFile, setSfxFile] = useState<File | null>(null)
  const [sfxVolume, setSfxVolume] = useState(0.5) // ?�과??볼륨 (0-1)
  const [sfxStartTime, setSfxStartTime] = useState(0) // ?�과???�작 ?�간 (�?
  const [sfxEndTime, setSfxEndTime] = useState(0) // ?�과??종료 ?�간 (�?
  
  // ?�디???�이브러�?관???�태
  const [bgmLibrary, setBgmLibrary] = useState<AudioLibraryItem[]>([])
  const [sfxLibrary, setSfxLibrary] = useState<AudioLibraryItem[]>([])
  const [isLoadingAudioLibrary, setIsLoadingAudioLibrary] = useState(false)
  const [showBgmLibraryDialog, setShowBgmLibraryDialog] = useState(false)
  const [showSfxLibraryDialog, setShowSfxLibraryDialog] = useState(false)
  
  // ?�상 ?�과 �??�환
  const [transitionEffect, setTransitionEffect] = useState<"none" | "fade" | "slide" | "zoom">("fade")
  const [transitionDuration, setTransitionDuration] = useState(0.5) // ?�환 ?�간 (�?
  
  // ?�목/?�명/?�그 ?�동 ?�성
  const [youtubeTitle, setYoutubeTitle] = useState("")
  const [youtubeDescription, setYoutubeDescription] = useState("")
  const [youtubeTags, setYoutubeTags] = useState<string[]>([])
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false)
  const [copiedTitle, setCopiedTitle] = useState(false)
  const [copiedDescription, setCopiedDescription] = useState(false)
  const [copiedTags, setCopiedTags] = useState(false)

  // ?�로?�트 관�??�태
  const [projects, setProjects] = useState<ShoppingProject[]>([])
  const [currentProject, setCurrentProject] = useState<ShoppingProject | null>(null)
  const [showProjectList, setShowProjectList] = useState(true) // ?�로?�트 목록 ?�면 ?�시 ?��?
  const [showFactoryView, setShowFactoryView] = useState(false) // ?�동??모드 UI 비활??(진입???�거)
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
  const [newFactoryVoiceId, setNewFactoryVoiceId] = useState("elevenlabs-jB1Cifc2UQbq1gR3wnb0")
  const [factoryAutoRunItem, setFactoryAutoRunItem] = useState<FactoryScheduleItem | null>(null)
  /** ?�동??모드 백그?�운???�이?�라???��???(?�차 처리?? */
  const [factoryPipelineQueue, setFactoryPipelineQueue] = useState<FactoryScheduleItem[]>([])
  /** ?�재 ?�이?�라???�행 중인 ?�약 ID (목록?�서 '?�업 �? ?�시?? */
  const [factoryPipelineRunningItemId, setFactoryPipelineRunningItemId] = useState<string | null>(null)
  const factoryPipelineRunningRef = useRef(false)
  const [showFactorySettingsDialog, setShowFactorySettingsDialog] = useState(false)
  const [showFactoryPasswordDialog, setShowFactoryPasswordDialog] = useState(false)
  const [factoryPasswordInput, setFactoryPasswordInput] = useState("")
  const [uploadingFactoryId, setUploadingFactoryId] = useState<string | null>(null)
  const [youtubeChannelName, setYoutubeChannelName] = useState<string | null>(null) // ?�동???�튜�?채널�?(?�동??모드 ???�동 ?�로?�용)
  const [youtubeClientId, setYoutubeClientId] = useState("")
  const [youtubeClientSecret, setYoutubeClientSecret] = useState("")
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isSavingProject, setIsSavingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDescription, setNewProjectDescription] = useState("")
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false)
  const [projectSearchQuery, setProjectSearchQuery] = useState("") // ?�로?�트 검?�어
  const [userId, setUserId] = useState<string>("") // ?�용??ID
  const [isEditingProjectName, setIsEditingProjectName] = useState(false)
  const [editingProjectName, setEditingProjectName] = useState("")

  // ?�스�?챗봇 ?�태
  const [isChatbotOpen, setIsChatbotOpen] = useState(false) // 챗봇 ?�림/?�힘
  const [chatbotMessages, setChatbotMessages] = useState<Array<{ type: "user" | "assistant"; content: string }>>([]) // 챗봇 메시지
  const [chatbotInput, setChatbotInput] = useState<string>("") // 챗봇 ?�력
  const [isChatbotGenerating, setIsChatbotGenerating] = useState(false) // 챗봇 ?�답 ?�성 �?
  // ?�이�??�기 ?�워???�태
  const [trendingKeywords, setTrendingKeywords] = useState<string[]>([])
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(false)
  const [showKeywordsDialog, setShowKeywordsDialog] = useState(false)

  // ?�이�??�기 ?�워??가?�오�?  const handleLoadTrendingKeywords = async () => {
    setIsLoadingKeywords(true)
    setShowKeywordsDialog(true)
    
    // 최소 5�??�안 ?�니메이???��?
    const minLoadingTime = 5000
    const startTime = Date.now()
    
    try {
      const keywords = await getNaverTrendingKeywords("?�핑")
      console.log("[Frontend] 받�? ?�워??", keywords)
      
      // 최소 로딩 ?�간??지?��? ?�았?�면 ?��?      const elapsedTime = Date.now() - startTime
      if (elapsedTime < minLoadingTime) {
        await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsedTime))
      }
      
      setTrendingKeywords(keywords || [])
      
      // ?�워?��? ?�으�?기본 ?�워???�시
      if (!keywords || keywords.length === 0) {
        const defaultKeywords = [
          "?�로",
          "?�딩",
          "코트",
          "목도�?,
          "?�갑",
          "부�?,
          "?�트??,
          "?�복",
          "?�요",
          "?�기?�판"
        ]
        setTrendingKeywords(defaultKeywords)
      }
    } catch (error) {
      console.error("?�기 ?�워??로드 ?�패:", error)
      
      // 최소 로딩 ?�간??지?��? ?�았?�면 ?��?      const elapsedTime = Date.now() - startTime
      if (elapsedTime < minLoadingTime) {
        await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsedTime))
      }
      
      // ?�러 발생 ?�에??기본 ?�워???�시
      const defaultKeywords = [
        "?�로",
        "?�딩",
        "코트",
        "목도�?,
        "?�갑",
        "부�?,
        "?�트??,
        "?�복",
        "?�요",
        "?�기?�판"
      ]
      setTrendingKeywords(defaultKeywords)
    } finally {
      setIsLoadingKeywords(false)
    }
  }

  // ?�워???�택 ???�품명에 ?�동 ?�력 + 쿠팡 검??  const handleSelectKeyword = (keyword: string) => {
    setProductName(keyword)
    setCoupangSearchQuery(keyword)
    setShowKeywordsDialog(false)
    void searchCoupangProducts(keyword)
  }

  const productImageDisplayUrl = (url: string) => {
    if (!url) return url
    if (url.startsWith("data:")) return url
    if (url.startsWith("http")) {
      return `/api/shotform/image-proxy?url=${encodeURIComponent(url)}`
    }
    return url
  }

  const searchCoupangProducts = async (keyword: string) => {
    const normalized = keyword.trim()
    if (!normalized) return
    setCoupangSearchQuery(normalized)
    setIsSearchingCoupang(true)
    setCoupangSearchError("")
    try {
      const response = await fetch(
        `/api/shotform/keyword-analysis/coupang?mode=search&query=${encodeURIComponent(normalized)}`
      )
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "쿠팡 ?�품??검?�하지 못했?�니??")
      }
      const products = Array.isArray(data.products) ? (data.products as CoupangRankedProduct[]) : []
      setCoupangProducts(products)
      if (!products.length) {
        setCoupangSearchError("?�치?�는 쿠팡 ?�품??찾�? 못했?�니?? 검?�어�?짧게 ?�정?�보?�요.")
      }
    } catch (reason) {
      setCoupangSearchError(reason instanceof Error ? reason.message : "쿠팡 검?�에 ?�패?�습?�다.")
      setCoupangProducts([])
    } finally {
      setIsSearchingCoupang(false)
    }
  }

  const handleSelectCoupangProduct = (product: CoupangRankedProduct) => {
    setSelectedCoupangProduct(product)
    setProductName(product.productName)
    setProductDescription(
      [
        product.categoryName ? `쿠팡 카테고리: ${product.categoryName}` : "",
        product.isRocket ? "로켓배송 ?�품" : "",
        `${product.productPrice.toLocaleString("ko-KR")}??,
        `${animalCharacter.name}??가) 쿠팡?�서 고른 ???�품??매장?�서 ?�제�??�용·?�연?�는 ?�폼`,
      ]
        .filter(Boolean)
        .join("\n")
    )
    setCoupangUrl(product.productUrl)
    // ?�선 CDN URL�??�시, ?�어??nano-banana 참조??data URL�?변??    setProductImage(product.productImage)
    setProductImageFile(null)
    const preview = new Image()
    preview.onload = () => setProductImageAspectRatio(preview.width / preview.height)
    preview.onerror = () => setProductImageAspectRatio(1)
    preview.src = productImageDisplayUrl(product.productImage)

    void (async () => {
      try {
        const proxy = `/api/shotform/image-proxy?url=${encodeURIComponent(product.productImage)}`
        const res = await fetch(proxy)
        if (!res.ok) return
        const blob = await res.blob()
        if (!blob.type.startsWith("image/")) return
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ""))
          reader.onerror = () => reject(new Error("?��?지 변???�패"))
          reader.readAsDataURL(blob)
        })
        if (!dataUrl.startsWith("data:image/")) return
        setProductImage(dataUrl)
        const img = new Image()
        img.onload = () => setProductImageAspectRatio(img.width / img.height)
        img.src = dataUrl
        console.log("[Shopping] 쿠팡 ?�품 ?��?지�??�퍼?�스 data URL�?변???�료")
      } catch (error) {
        console.warn("[Shopping] 쿠팡 ?�품 ?��?지 data URL 변???�패 (?�본 URL ?��?):", error)
      }
    })()
  }

  // ?�용??ID 가?�오�?  useEffect(() => {
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
        console.error("[Shopping Projects] ?�용???�보 조회 ?�패:", error)
        const storedUserId = localStorage.getItem("user_id") || localStorage.getItem("user_email") || "anonymous"
        setUserId(storedUserId)
      }
    }
    
    fetchUserInfo()
  }, [])

  // ?�약 발행 목록 로드 (ShotForm ?�핑)
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

  // ?�동??모드 목록 로드
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

  // 공장 ?�동 ?�행 중일 ???�재 ?�계(activeStep)�??�약 ??��??반영
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

  // ?�약 추�? ?�이?�로�??�릴 ???�퍼??목록???�으�??�동 로드
  useEffect(() => {
    if (showAddFactoryScheduleDialog && supertoneVoices.length === 0 && !isLoadingSupertoneVoices) {
      fetchSupertoneVoices()
    }
  }, [showAddFactoryScheduleDialog])

  // ?�동??모드: ?�튜�?채널 ?�동 ?�태 로드 (localStorage) + OAuth 콜백 처리
  useEffect(() => {
    const key = "shopping_animal_factory_youtube_channel"
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem(key) : null
      if (saved) setYoutubeChannelName(saved)
      const savedId = typeof window !== "undefined" ? localStorage.getItem("shopping_animal_factory_youtube_client_id") : null
      const savedSecret = typeof window !== "undefined" ? localStorage.getItem("shopping_animal_factory_youtube_client_secret") : null
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
        access_denied: "YouTube ?�동??취소?�었?�니??",
        no_code: "?�증 코드�?받�? 못했?�니??",
        config: "YouTube API ?�정???�인?�주?�요.",
        no_tokens: "?�큰??받�? 못했?�니?? ?�시 ?�도?�주?�요.",
        callback_failed: "?�동 처리 �??�류가 발생?�습?�다.",
      }
      alert(messages[errorFromUrl] || `?�동 ?�류: ${errorFromUrl}`)
      window.history.replaceState({}, "", window.location.pathname + (window.location.hash || ""))
    }
  }, [])

  // ?�로?�트 목록 불러?�기
  useEffect(() => {
    if (userId && showProjectList) {
      loadProjects()
    }
  }, [userId, showProjectList])

  // ?�네????���??�아?�을 ???�네???�시 그리�?  useEffect(() => {
    if (activeStep === "thumbnail" && thumbnailUrl && thumbnailCanvasRef.current) {
      // ?�택???�네?�이 AI ?�성 ?�네?�인지 ?�인
      const selectedThumbnail = selectedThumbnailIndex >= 0 ? thumbnailImages[selectedThumbnailIndex] : null
      if (selectedThumbnail && !selectedThumbnail.isCustom) {
        // AI ?�성 ?�네?��? ?��? ?�스?��? ?�함?�어 ?�으므�?그�?�??�시 (비율 ?��?)
        const canvas = thumbnailCanvasRef.current
        const ctx = canvas.getContext("2d")
        if (ctx) {
          canvas.width = 1080
          canvas.height = 1920
          const img = new Image()
          img.crossOrigin = "anonymous"
          img.src = thumbnailUrl
          img.onload = () => {
            // 비율 ?��??�며 그리�?            const imgAspect = img.width / img.height
            const canvasAspect = canvas.width / canvas.height
            
            let drawWidth: number
            let drawHeight: number
            let offsetX: number
            let offsetY: number
            
            if (imgAspect > canvasAspect) {
              // ?��?지가 ???�음 - ?�이??맞추�?좌우 ?�롭
              drawHeight = canvas.height
              drawWidth = drawHeight * imgAspect
              offsetX = (canvas.width - drawWidth) / 2
              offsetY = 0
            } else {
              // ?��?지가 ???�음 - ?�비??맞추�??�하 ?�롭
              drawWidth = canvas.width
              drawHeight = drawWidth / imgAspect
              offsetX = 0
              offsetY = (canvas.height - drawHeight) / 2
            }
            
            // 검?� 배경?�로 채우�?            ctx.fillStyle = "black"
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            
            // ?��?지 그리�?(비율 ?��?)
            ctx.drawImage(img, 0, 0, img.width, img.height, offsetX, offsetY, drawWidth, drawHeight)
          }
        }
      } else if (selectedThumbnail && selectedThumbnail.isCustom && thumbnailHookingText.line1) {
        // 직접 ?�성 ?�네?��? ?�스?��? ?�더�?        renderThumbnailWithText(thumbnailUrl, thumbnailHookingText)
      }
    }
  }, [activeStep, thumbnailUrl, thumbnailHookingText, selectedThumbnailIndex, thumbnailImages])

  // 직접 ?�성 모드: ?��?지?� ?�스?��? 모두 ?�을 ???�시�?미리보기 ?�데?�트
  useEffect(() => {
    if (thumbnailMode === "manual" && customThumbnailImage && customThumbnailText.line1 && customThumbnailText.line2) {
      renderThumbnailWithText(customThumbnailImage, customThumbnailText)
    }
  }, [thumbnailMode, customThumbnailImage, customThumbnailText, customThumbnailTextStyle])

  // ?�역 마우???�벤?�로 ?�들 ?�래�?처리
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!previewAudio) return
      
      // BGM ?�들 ?�래�?      if (draggingBgmHandle && bgmUrl && bgmTimelineRef.current) {
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
      
      // ?�과???�들 ?�래�?      if (draggingSfxHandle && sfxUrl && sfxTimelineRef.current) {
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

  // BGM URL 변�????�전 BGM ?�리
  useEffect(() => {
    return () => {
      // 컴포?�트 ?�마?�트 ?�는 bgmUrl 변�????�전 BGM ?�리
      if (previewBgmAudio) {
        console.log("[Shopping] BGM URL 변�??�는 컴포?�트 ?�마?�트 - ?�전 BGM ?�리")
        previewBgmAudio.pause()
        previewBgmAudio.currentTime = 0
        previewBgmAudio.src = "" // ?�디???�스 ?�거
        previewBgmAudio.load() // ?�디??리소???�제
        setPreviewBgmAudio(null)
      }
    }
  }, [bgmUrl, previewBgmAudio])

  // ?�디???�이브러�?로드
  useEffect(() => {
    const loadAudioLibrary = async () => {
      if (activeStep === "preview") {
        console.log("[Shopping] ?�디???�이브러�?로드 ?�작 (?�라?�언??")
        setIsLoadingAudioLibrary(true)
        try {
          console.log("[Shopping] getAllAudioLibrary ?�출 ??)
          const result = await getAllAudioLibrary()
          console.log("[Shopping] getAllAudioLibrary ?�출 ??- 결과:", result)
          console.log("[Shopping] ?�디???�이브러�?로드 ?�료 - BGM:", result.bgm.length, "�? SFX:", result.sfx.length, "�?)
          console.log("[Shopping] BGM 목록:", result.bgm.map(a => a.name))
          console.log("[Shopping] SFX 목록:", result.sfx.map(a => a.name))
          setBgmLibrary(result.bgm)
          setSfxLibrary(result.sfx)
        } catch (error) {
          console.error("[Shopping] ?�디???�이브러�?로드 ?�패 (?�라?�언??:", error)
          // ?�러가 발생?�도 �?배열�??�정
          setBgmLibrary([])
          setSfxLibrary([])
        } finally {
          setIsLoadingAudioLibrary(false)
        }
      } else {
        // preview ?�계가 ?�니�??�이브러�?초기??        setBgmLibrary([])
        setSfxLibrary([])
      }
    }
    loadAudioLibrary()
  }, [activeStep])

  // preview ?�계 진입 ???�튜�?메�??�이???�동 ?�성
  useEffect(() => {
    const generateMetadataOnPreview = async () => {
      // preview ?�계?�고, ?�본이 ?�고, 메�??�이?��? ?�을 ?�만 ?�동 ?�성
      if (activeStep === "preview" && script.trim() && !youtubeTitle && !youtubeDescription && youtubeTags.length === 0) {
        const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined
        
        if (openaiApiKey) {
          console.log("[Shopping] preview ?�계 진입, ?�튜�?메�??�이???�동 ?�성 ?�작")
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
            console.log("[Shopping] ?�튜�?메�??�이???�동 ?�성 ?�료")
          } catch (error) {
            console.error("메�??�이???�동 ?�성 ?�패:", error)
            // ?�동 ?�성 ?�패?�도 계속 진행 (?�용?��? ?�동?�로 ?�성?????�음)
          } finally {
            setIsGeneratingMetadata(false)
          }
        }
      }
    }

    generateMetadataOnPreview()
  }, [activeStep, script, productName, productDescription, youtubeTitle, youtubeDescription, youtubeTags])

  // ?�로?�트 목록 로드
  const loadProjects = async () => {
    if (!userId) return
    
    setIsLoadingProjects(true)
    try {
      const projectsList = await getShoppingProjects(userId)
      // 최신 ?�업 ?�으�??�렬 (updated_at 기�?, ?�으�?created_at 기�?)
      const sortedProjects = [...projectsList].sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at).getTime()
        const dateB = new Date(b.updated_at || b.created_at).getTime()
        return dateB - dateA // 최신??(?�림차순)
      })
      setProjects(sortedProjects)
    } catch (error) {
      console.error("?�로?�트 목록 로드 ?�패:", error)
      alert("?�로?�트 목록??불러?�는???�패?�습?�다.")
    } finally {
      setIsLoadingProjects(false)
    }
  }

  // ?�로?�트 ?�??  const saveProject = async (projectName?: string, isNewProject: boolean = false) => {
    if (!userId) {
      alert("로그?�이 ?�요?�니??")
      return
    }

    // ?�로?�트 ?�름 결정 (?�품명과 별도�?관�?
    let name: string
    if (isNewProject) {
      // ???�로?�트 ?�성 ?? 반드???�력받�? ?�름 ?�용
      name = newProjectName || projectName || "???�로?�트"
    } else if (currentProject) {
      // 기존 ?�로?�트 ?�데?�트 ?? ?�재 ?�로?�트 ?�름 ?��? ?�는 ?�력받�? ?�름 ?�용
      name = projectName || currentProject.name
    } else {
      // ?�로?�트가 ?�는 경우: ?�력받�? ?�름 ?�는 기본�?      name = projectName || newProjectName || "???�로?�트"
    }
    
    if (!name.trim()) {
      alert("?�로?�트 ?�름???�력?�주?�요.")
      return
    }

    setIsSavingProject(true)
    try {
      // TTS: ?�면???�오???�디??URL 그�?�??�??(TTS ?�성 ???��? Supabase ?�로?�한 ?�구 URL?�면 그�?�? blob?�면 ?�로????URL�??�??
      let finalTtsAudioUrl = ttsAudioUrl && ttsAudioUrl.trim() ? ttsAudioUrl : undefined
      if (finalTtsAudioUrl && finalTtsAudioUrl.startsWith("blob:")) {
        const projectIdForUpload = currentProject?.id
        if (projectIdForUpload) {
        try {
          const audioResponse = await fetch(finalTtsAudioUrl)
          const audioBlob = await audioResponse.blob()
            finalTtsAudioUrl = await uploadTTSAudio(audioBlob, projectIdForUpload, userId)
        } catch (uploadError) {
            console.error("[Shopping] ?�디???�로???�패:", uploadError)
            finalTtsAudioUrl = currentProject?.data?.ttsAudioUrl && !currentProject.data.ttsAudioUrl.startsWith("blob:") ? currentProject.data.ttsAudioUrl : undefined
          }
        } else {
          finalTtsAudioUrl = undefined
        }
      }
      if (currentProject && !isNewProject && finalTtsAudioUrl && finalTtsAudioUrl.startsWith("blob:")) {
        finalTtsAudioUrl = currentProject.data?.ttsAudioUrl && !currentProject.data.ttsAudioUrl.startsWith("blob:") ? currentProject.data.ttsAudioUrl : undefined
      }
      // 기존 ?�로?�트 ?�데?�트 ?? final???�어??기존 ttsAudioUrl ??��?��? ?�음 (?�로???�패 ???��?)
      const ttsAudioUrlToSave =
        currentProject && !isNewProject
          ? (finalTtsAudioUrl !== undefined ? finalTtsAudioUrl : currentProject.data?.ttsAudioUrl)
          : finalTtsAudioUrl
      
      const projectData: ShoppingProjectData = {
        animalCharacter,
        productName: productName ?? undefined,
        productDescription: productDescription ?? undefined,
        productImage: productImage !== null ? productImage : undefined,
        coupangUrl: coupangUrl || undefined,
        coupangSearchQuery: coupangSearchQuery || undefined,
        selectedCoupangProduct: selectedCoupangProduct
          ? {
              productId: selectedCoupangProduct.productId,
              productName: selectedCoupangProduct.productName,
              productPrice: selectedCoupangProduct.productPrice,
              productImage: selectedCoupangProduct.productImage,
              productUrl: selectedCoupangProduct.productUrl,
              categoryName: selectedCoupangProduct.categoryName,
              isRocket: selectedCoupangProduct.isRocket,
            }
          : undefined,
        videoDuration,
        script,
        editedScript,
        selectedVoiceId,
        selectedSupertoneVoiceId,
        selectedSupertoneStyle,
        ttsAudioUrl: ttsAudioUrlToSave,
        ttsSpeed,
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
        // 기존 ?�로?�트 ?�데?�트
        await updateShoppingProject(currentProject.id, {
          name,
          description: newProjectDescription || undefined,
          data: projectData,
        })
        if (ttsAudioUrlToSave && !ttsAudioUrlToSave.startsWith("blob:")) {
          setTtsAudioUrl(ttsAudioUrlToSave)
        }
        alert("?�로?�트가 ?�?�되?�습?�다.")
      } else {
        // ???�로?�트 ?�성 ?�에 모든 ?�태 초기??        const freshCharacter = createDefaultAnimalCharacter()
        setAnimalCharacter(freshCharacter)
        setProductName("")
        setProductDescription("")
        setProductImage(null)
        setProductImageFile(null)
        setCoupangSearchQuery("")
        setCoupangProducts([])
        setSelectedCoupangProduct(null)
        setCoupangSearchError("")
        setCoupangUrl("")
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
        setSelectedVoiceId("ttsmaker-?�성1")
        setSelectedSupertoneVoiceId("")
        setSelectedSupertoneStyle("neutral")
        setSubtitleStyle({ ...DEFAULT_ANIMAL_SUBTITLE_STYLE })
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
        
        // �??�이?�로 ???�로?�트 ?�성
        const emptyProjectData: ShoppingProjectData = {
          animalCharacter: freshCharacter,
          activeStep: "product",
        }
        
        const newProject = await createShoppingProject(
          userId,
          name,
          newProjectDescription || undefined,
          emptyProjectData
        )
        setCurrentProject(newProject) // ???�로?�트�??�환
        
        // ???�로?�트 ?�성 ???�디?��? ?�시 URL?�면 ?�로??        if (finalTtsAudioUrl && finalTtsAudioUrl.startsWith("blob:")) {
          try {
            console.log("[Shopping] ???�로?�트 ?�성 ???�디???�일 ?�로??�?..")
            const audioResponse = await fetch(finalTtsAudioUrl)
            const audioBlob = await audioResponse.blob()
            const uploadedAudioUrl = await uploadTTSAudio(audioBlob, newProject.id, userId)
            
            // ?�로?�된 URL�??�로?�트 ?�데?�트
            await updateShoppingProject(newProject.id, {
              data: {
                ...projectData,
                ttsAudioUrl: uploadedAudioUrl,
              },
            })
            
            // ?�태???�데?�트
            setTtsAudioUrl(uploadedAudioUrl)
            console.log("[Shopping] ???�로?�트 ?�디???�일 ?�로???�료:", uploadedAudioUrl)
          } catch (uploadError) {
            console.error("[Shopping] ???�로?�트 ?�디???�일 ?�로???�패:", uploadError)
          }
        }
        
        setShowCreateProjectDialog(false)
        setNewProjectName("")
        setNewProjectDescription("")
        setShowProjectList(false) // ?�로?�트 목록 ?�고 ?�업 ?�면?�로 ?�동
      }
      
      await loadProjects()
    } catch (error) {
      console.error("?�로?�트 ?�???�패:", error)
      alert("?�로?�트 ?�?�에 ?�패?�습?�다.")
    } finally {
      setIsSavingProject(false)
    }
  }

  // ?�로?�트 불러?�기
  const loadProject = async (projectId: string) => {
    try {
      const project = await getShoppingProject(projectId)
      if (!project) {
        alert("?�로?�트�?찾을 ???�습?�다.")
        return
      }

      const data = project.data
      
      // ?�로?�트 ?�이??복원 (TTS ?�태 ?�함)
      setAnimalCharacter(data.animalCharacter || createDefaultAnimalCharacter())
      if (data.productName) setProductName(data.productName)
      if (data.productDescription) setProductDescription(data.productDescription)
      if (data.coupangUrl) setCoupangUrl(data.coupangUrl)
      if (data.coupangSearchQuery) setCoupangSearchQuery(data.coupangSearchQuery)
      if (data.selectedCoupangProduct) {
        setSelectedCoupangProduct({
          ...data.selectedCoupangProduct,
          rank: 0,
        })
      } else {
        setSelectedCoupangProduct(null)
      }
      if (data.productImage) {
        setProductImage(data.productImage)
        // ?��?지 비율 계산
        const img = new Image()
        img.onload = () => {
          const aspectRatio = img.width / img.height
          setProductImageAspectRatio(aspectRatio)
        }
        img.src = data.productImage.startsWith("http")
          ? `/api/shotform/image-proxy?url=${encodeURIComponent(data.productImage)}`
          : data.productImage
      }
      if (data.videoDuration) setVideoDuration(data.videoDuration)
      if (data.script) setScript(data.script)
      if (data.editedScript) setEditedScript(data.editedScript)
      if (data.selectedVoiceId) {
        setSelectedVoiceId(
          data.selectedVoiceId.startsWith("ttsmaker-")
            ? "elevenlabs-jB1Cifc2UQbq1gR3wnb0"
            : data.selectedVoiceId
        )
      }
      if (data.selectedSupertoneVoiceId) setSelectedSupertoneVoiceId(data.selectedSupertoneVoiceId)
      if (data.selectedSupertoneStyle) setSelectedSupertoneStyle(data.selectedSupertoneStyle)
      if (typeof data.ttsSpeed === "number") setTtsSpeed(data.ttsSpeed)
      // TTS ?�디??URL 복원 (�?문자?�이 ?�닌 경우?�만)
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
        ...DEFAULT_ANIMAL_SUBTITLE_STYLE,
        ...data.subtitleStyle,
        positionOffset: data.subtitleStyle.positionOffset ?? 0,
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
      console.error("?�로?�트 불러?�기 ?�패:", error)
      alert("?�로?�트�?불러?�는???�패?�습?�다.")
    }
  }

  // ?�로?�트 ??��
  const handleDeleteProject = async (projectId: string) => {
    if (!confirm("?�말 ???�로?�트�???��?�시겠습?�까?")) return

    try {
      await deleteShoppingProject(projectId)
      if (currentProject?.id === projectId) {
        setCurrentProject(null)
        setShowProjectList(true)
      }
      await loadProjects()
      alert("?�로?�트가 ??��?�었?�니??")
    } catch (error) {
      console.error("?�로?�트 ??�� ?�패:", error)
      alert("?�로?�트 ??��???�패?�습?�다.")
    }
  }

  // ?�일 처리 공통 ?�수
  const processImageFile = (file: File) => {
    // ?��?지 ?�일?��? ?�인
    if (!file.type.startsWith("image/")) {
      alert("?��?지 ?�일�??�로??가?�합?�다.")
      return
    }

    // ?�일 ?�기 ?�한 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert("?��?지 ?�기??10MB ?�하?�야 ?�니??")
      return
    }

    setProductImageFile(file)

    // 미리보기�??�한 URL ?�성
    const reader = new FileReader()
    reader.onloadend = () => {
      const imageUrl = reader.result as string
      setProductImage(imageUrl)
      
      // ?��?지 비율 계산
      const img = new Image()
      img.onload = () => {
        const aspectRatio = img.width / img.height
        setProductImageAspectRatio(aspectRatio)
        console.log(`[Shopping] ?�품 ?��?지 비율: ${img.width}x${img.height} = ${aspectRatio.toFixed(2)}`)
      }
      img.src = imageUrl
    }
    reader.readAsDataURL(file)
  }

  // ?��?지 ?�로??처리
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    processImageFile(file)
  }

  // ?�래�????�롭 처리
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

  // ?��?지 ?�거
  const handleRemoveImage = () => {
    setProductImage(null)
    setProductImageFile(null)
    setProductImageAspectRatio(null)
    setSelectedCoupangProduct(null)
    setCoupangUrl("")
  }

  // ?�스�?챗봇 메시지 ?�송 ?�수
  const handleChatbotSend = async () => {
    if (!chatbotInput.trim() || isChatbotGenerating) return

    const userMessage = chatbotInput.trim()
    setChatbotInput("")
    setChatbotMessages((prev) => [...prev, { type: "user", content: userMessage }])
    setIsChatbotGenerating(true)

    try {
      // WingsAIStudioShotForm ?�정?�서 OpenAI API ??가?�오�?      const apiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || null : null
      if (!apiKey) {
        setChatbotMessages((prev) => [...prev, {
          type: "assistant",
          content: "OpenAI API ?��? ?�요?�니?? ?�정?�서 API ?��? ?�력?�주?�요."
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
              content: "?�신?� ?�스봇입?�다. WingsAIStudioShotForm??AI ?�시?�턴?�로???�용?�에�?친절?�고 ?��????�는 ?��????�공?�니?? ?�핑 ?�폼 ?�상 ?�작, ?��??�성, ?��?지 ?�성, TTS ?�에 ?�??질문???��??????�습?�다."
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
        throw new Error(errorData.error?.message || "?�답 ?�성???�패?�습?�다.")
      }

      const data = await response.json()
      const reply = data.choices[0]?.message?.content || "?�답 ?�성???�패?�습?�다."

      setChatbotMessages((prev) => [...prev, { type: "assistant", content: reply }])
    } catch (error) {
      console.error("챗봇 ?�답 ?�성 ?�패:", error)
      const errorMessage = error instanceof Error ? error.message : "?????�는 ?�류가 발생?�습?�다."
      setChatbotMessages((prev) => [...prev, {
        type: "assistant",
        content: `죄송?�니?? ?�류가 발생?�습?�다: ${errorMessage}`
      }])
    } finally {
      setIsChatbotGenerating(false)
    }
  }

  const handleSelectCharacterPreset = (presetId: string) => {
    const next = createCharacterFromPreset(presetId)
    // 같�? ?�리?�을 ?�시 골라???�퍼?�스???��??��? ?�음 (??캐릭??
    setAnimalCharacter(next)
  }

  const handleUpdateCharacterField = <K extends keyof AnimalCharacter>(key: K, value: AnimalCharacter[K]) => {
    setAnimalCharacter((prev) => {
      const next = { ...prev, [key]: value }
      if (key === "breedOrLook" || key === "species") {
        if (next.presetId === "custom" || key === "breedOrLook") {
          next.visualPromptEn = buildCustomVisualPromptEn(
            String(key === "breedOrLook" ? value : next.breedOrLook),
            (key === "species" ? value : next.species) as AnimalSpecies
          )
        }
      }
      return next
    })
  }

  const handleCharacterReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      alert("?��?지 ?�일�??�로??가?�합?�다.")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("?��?지 ?�기??10MB ?�하?�야 ?�니??")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : ""
      if (!result) return
      setAnimalCharacter((prev) => ({ ...prev, referenceImage: result }))
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const handleGenerateCharacterReference = async () => {
    if (animalCharacter.presetId === "custom" && !animalCharacter.breedOrLook.trim()) {
      alert("커스?� 캐릭?�는 ?�형 ?�명??먼�? ?�력?�주?�요.")
      return
    }
    const replicateApiKey =
      typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined
    if (!replicateApiKey) {
      alert("Replicate API ?��? ?�요?�니?? 메인 ?�면???�정?�서 API ?��? ?�력?�주?�요.")
      return
    }
    setIsGeneratingCharacterRef(true)
    setError("")
    try {
      const characterForGen: AnimalCharacter = {
        ...animalCharacter,
        visualPromptEn:
          animalCharacter.presetId === "custom"
            ? buildCustomVisualPromptEn(animalCharacter.breedOrLook, animalCharacter.species)
            : animalCharacter.visualPromptEn,
      }
      const url = await generateCharacterReferenceImage(characterForGen, replicateApiKey)
      setAnimalCharacter((prev) => ({
        ...characterForGen,
        id: prev.id,
        referenceImage: url,
      }))
    } catch (err) {
      console.error("캐릭???�퍼?�스 ?�성 ?�패:", err)
      setError(`캐릭???�성???�패?�습?�다: ${err instanceof Error ? err.message : "?????�는 ?�류"}`)
    } finally {
      setIsGeneratingCharacterRef(false)
    }
  }

  // ?��??�성
  const handleGenerateScript = async () => {
    if (!productName.trim()) {
      alert("?�품명을 ?�력?�주?�요.")
      return
    }
    if (animalCharacter.presetId === "custom" && !animalCharacter.breedOrLook.trim()) {
      alert("캐릭???�형 ?�명???�력?�거???�리?�을 ?�택?�주?�요.")
      return
    }

    const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined

    if (!openaiApiKey) {
      alert("OpenAI API ?��? ?�요?�니?? 메인 ?�면???�정(?�니바�??�이�??�서 API ?��? ?�력?�주?�요.")
      return
    }

    setIsGeneratingScript(true)
    setError("")

    try {
      // ?�품 ?�명???�으�?그것??기반?�로, ?�으�??�품명만 ?�용
      const scriptPrompt = productDescription.trim() 
        ? `${productName}. ${productDescription}` 
        : productName
      
      const generatedScript = await generateShoppingScript(
        productName,
        scriptPrompt,
        openaiApiKey,
        videoDuration,
        animalCharacter
      )
      setScript(generatedScript)
      setEditedScript(generatedScript)
      setActiveStep("script")
      
      // ?��??�성 ???�동?�로 ?�트 분석
      try {
        setIsAnalyzingScript(true)
        const parts = await analyzeScriptParts(generatedScript, openaiApiKey)
        setScriptParts(parts)
      } catch (error) {
        console.error("?��?분석 ?�패:", error)
        setScriptParts([])
      } finally {
        setIsAnalyzingScript(false)
      }
    } catch (error) {
      console.error("?��??�성 ?�패:", error)
      setError(`?��??�성???�패?�습?�다: ${error instanceof Error ? error.message : "?????�는 ?�류"}`)
    } finally {
      setIsGeneratingScript(false)
    }
  }

  // ?��??�집 ?�??  const handleSaveEditedScript = () => {
    setScript(editedScript)
    setIsEditingScript(false)
  }

  // BGM ?�일 ?�로??  const handleBgmUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("audio/")) {
      alert("?�디???�일�??�로??가?�합?�다.")
      return
    }

    setBgmFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setBgmUrl(reader.result as string)
      
      // 기본 종료 ?�간??10초로 ?�정
      setBgmEndTime(10)
    }
    reader.readAsDataURL(file)
  }

  // ?�과???�일 ?�로??  const handleSfxUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("audio/")) {
      alert("?�디???�일�??�로??가?�합?�다.")
      return
    }

    setSfxFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setSfxUrl(reader.result as string)
      
      // ?�일 ?�기 ?�인 �?기본 종료 ?�간 ?�정
      const audio = new Audio(reader.result as string)
      audio.onloadedmetadata = () => {
        if (sfxEndTime === 0 || sfxEndTime > audio.duration) {
          setSfxEndTime(audio.duration)
        }
      }
    }
    reader.readAsDataURL(file)
  }

  // ?�디???�이브러리에??BGM ?�택
  const handleSelectBgmFromLibrary = (audioItem: AudioLibraryItem) => {
    setBgmUrl(audioItem.url)
    setBgmFile(null) // ?�이브러리에???�택??경우 ?�일?� null
    
    // 기본 종료 ?�간??10초로 ?�정
    setBgmEndTime(10)
    setShowBgmLibraryDialog(false)
  }

  // BGM ??��
  const handleDeleteBgm = () => {
    // BGM ?�리
    if (previewBgmAudio) {
      previewBgmAudio.pause()
      previewBgmAudio.currentTime = 0
      previewBgmAudio.src = ""
      previewBgmAudio.load()
      setPreviewBgmAudio(null)
    }
    
    // ?�태 초기??    setBgmUrl("")
    setBgmFile(null)
    setBgmVolume(0.3)
    setBgmStartTime(0)
    setBgmEndTime(0)
  }

  // ?�과????��
  const handleDeleteSfx = () => {
    if (previewSfxAudio) {
      previewSfxAudio.pause()
      previewSfxAudio.currentTime = 0
      previewSfxAudio.src = ""
      previewSfxAudio.load()
      setPreviewSfxAudio(null)
    }
    setSfxUrl("")
    setSfxFile(null)
    setSfxVolume(0.5)
    setSfxStartTime(0)
    setSfxEndTime(0)
  }

  // ?�디???�이브러리에???�과???�택
  const handleSelectSfxFromLibrary = (audioItem: AudioLibraryItem) => {
    setSfxUrl(audioItem.url)
    setSfxFile(null) // ?�이브러리에???�택??경우 ?�일?� null
    
    // ?�디??길이 ?�인
    const audio = new Audio(audioItem.url)
    audio.onloadedmetadata = () => {
      if (sfxEndTime === 0 || sfxEndTime > audio.duration) {
        setSfxEndTime(audio.duration)
      }
    }
    setShowSfxLibraryDialog(false)
  }

  // ?�목/?�명/?�그 ?�동 ?�성
  const handleGenerateMetadata = async () => {
    if (!script.trim()) {
      alert("?�본이 ?�습?�다. 먼�? ?�본을 ?�성?�주?�요.")
      return
    }

    const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined

    if (!openaiApiKey) {
      alert("OpenAI API ?��? ?�요?�니??")
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
      console.error("메�??�이???�성 ?�패:", error)
      alert(`메�??�이???�성???�패?�습?�다: ${error instanceof Error ? error.message : "?????�는 ?�류"}`)
    } finally {
      setIsGeneratingMetadata(false)
    }
  }

  // ?�퍼???�성 목록 가?�오�?  const fetchSupertoneVoices = async () => {
    setIsLoadingSupertoneVoices(true)
    try {
      // WingsAIStudioShotForm ?�정창에?�만 API ??가?�오�?      const supertoneApiKey = typeof window !== "undefined" 
        ? (localStorage.getItem("shotform_supertone_api_key") || "").trim() 
        : null
      if (!supertoneApiKey || supertoneApiKey.length === 0) {
        alert("?�퍼??API ?��? ?�요?�니?? ?�정?�서 API ?��? ?�력?�주?�요.\n\n?�퍼??API 콘솔(console.supertoneapi.com)?�서 API ?��? 발급받을 ???�습?�다.")
        setIsLoadingSupertoneVoices(false)
        return
      }

      // API ???�식 검�?      if (supertoneApiKey.length < 20) {
        alert(`?�퍼??API ???�식???�바르�? ?�습?�다. (길이: ${supertoneApiKey.length}??\n\n?�퍼??API 콘솔(console.supertoneapi.com)?�서 ?�바�?API ?��? ?�인?�고 ?�시 ?�력?�주?�요.`)
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
        throw new Error(errorData.error || "?�성 목록??가?�오?�데 ?�패?�습?�다.")
      }

      const data = await response.json()
      if (data.success && data.voices) {
        const excludedNames = ["?�팽?�A", "기억?�정???�마??, "?�새?�정???�마??]
        const filteredVoices = data.voices.filter((voice: { name: string }) => 
          !excludedNames.some(excluded => voice.name.includes(excluded))
        )
        setSupertoneVoices(filteredVoices)
        if (filteredVoices.length > 0 && !selectedSupertoneVoiceId) {
          setSelectedSupertoneVoiceId(filteredVoices[0].voice_id)
          setSelectedVoiceId(`supertone-${filteredVoices[0].voice_id}`)
        }
      } else {
        throw new Error(data.error || "?�성 목록??가?�오?�데 ?�패?�습?�다.")
      }
    } catch (error) {
      console.error("?�퍼???�성 목록 가?�오�??�패:", error)
      alert(`?�퍼???�성 목록??가?�오?�데 ?�패?�습?�다: ${error instanceof Error ? error.message : "?????�는 ?�류"}`)
    } finally {
      setIsLoadingSupertoneVoices(false)
    }
  }

  // 목소�?미리?�기 ?�수
  const handlePreviewVoice = async (voiceId: string) => {
    setPreviewingVoiceId(voiceId)
    
    try {
      let response: Response
      
      if (voiceId?.startsWith("supertone-")) {
        const actualVoiceId = voiceId.replace("supertone-", "")
        // WingsAIStudioShotForm ?�정창에?�만 API ??가?�오�?        const supertoneApiKey = typeof window !== "undefined" 
          ? (localStorage.getItem("shotform_supertone_api_key") || "").trim() 
          : null
        
        if (!supertoneApiKey) {
          alert("?�퍼??API ?��? ?�요?�니?? ?�정?�서 API ?��? ?�력?�주?�요.")
          setPreviewingVoiceId(null)
          return
        }
        
        response = await fetch("/api/supertone-tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: "?�러�??�영?�니??,
            voiceId: actualVoiceId,
            apiKey: supertoneApiKey,
            style: selectedSupertoneStyle || "neutral",
            language: "ko",
          }),
        })
      } else if (voiceId?.startsWith("ttsmaker-")) {
        const voiceName = voiceId.replace("ttsmaker-", "")
        const pitch = voiceName === "?�성5" ? 0.9 : 1.0
        const ttsmakerApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_ttsmaker_api_key") || undefined : undefined

        if (!ttsmakerApiKey) {
          alert("TTSMaker API ?��? ?�요?�니?? ?�정?�서 API ?��? ?�력?�주?�요.")
          setPreviewingVoiceId(null)
          return
        }
        
        response = await fetch("/api/ttsmaker", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: "?�러�??�영?�니??,
            voice: voiceName,
            speed: 1.0,
            pitch: pitch,
            apiKey: ttsmakerApiKey,
          }),
        })
      } else if (voiceId?.startsWith("elevenlabs-")) {
        // ElevenLabs??경우 - ?�두???�거
        const cleanVoiceId = voiceId.replace("elevenlabs-", "")
        // WingsAIStudioShotForm ?�정창에?�만 API ??가?�오�?        let elevenlabsApiKey = typeof window !== "undefined" 
          ? (localStorage.getItem("shotform_elevenlabs_api_key") || "").trim() 
          : null
        
        if (!elevenlabsApiKey || elevenlabsApiKey.length === 0) {
          alert("ElevenLabs API ?��? ?�요?�니?? ?�정?�서 API ?��? ?�력?�주?�요.")
          setPreviewingVoiceId(null)
          return
        }
        
        response = await fetch("/api/elevenlabs-tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: "?�러�??�영?�니??,
            voiceId: cleanVoiceId, // ?�두???�거???�수 Voice ID
            apiKey: elevenlabsApiKey,
          }),
        })
      } else {
        // 기본 TTSMaker 처리 (?�두???�는 경우)
        const voiceName = voiceId.replace("ttsmaker-", "") || "?�성1"
        const pitch = voiceName === "?�성5" ? 0.9 : 1.0
        const ttsmakerApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_ttsmaker_api_key") || undefined : undefined

        if (!ttsmakerApiKey) {
          alert("TTSMaker API ?��? ?�요?�니?? ?�정?�서 API ?��? ?�력?�주?�요.")
          setPreviewingVoiceId(null)
          return
        }
        
        response = await fetch("/api/ttsmaker", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: "?�러�??�영?�니??,
            voice: voiceName,
            speed: 1.0,
            pitch: pitch,
            apiKey: ttsmakerApiKey,
          }),
        })
      }

      if (!response.ok) {
        let errorMessage = "미리?�기 ?�패"
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
      console.error("미리?�기 ?�패:", error)
      alert(`미리?�기???�패?�습?�다: ${error instanceof Error ? error.message : "?????�는 ?�류"}`)
      setPreviewingVoiceId(null)
      setPreviewAudioUrl(null)
    }
  }

  // TTS ?�성 (3�??�면 ?�체 ?��? - ?��?지 ?�성보다 먼�?
  const handleGenerateTTS = async () => {
    if (!script.trim()) {
      alert("?�본이 ?�습?�다.")
      return
    }

    // ?�생????기존 ?�디??URL 초기??    if (ttsAudioUrl) {
      // Blob URL??경우 메모�??�제
      if (ttsAudioUrl.startsWith("blob:")) {
        URL.revokeObjectURL(ttsAudioUrl)
      }
      setTtsAudioUrl("")
    }

    setIsGeneratingTTS(true)
    setTtsProgress({ current: 0, total: 1 })
    setError("")

    try {
      // ?�체 ?�본을 ??번에 TTS ?�성 (?��?그�?�??�용 - ?��? ?�기�??�됨)
      console.log("[Shopping] TTS ?�성 �?.. (목소�?", selectedVoiceId, ")")
      console.log("[Shopping] ?��??�체 길이:", script.length, "??)
      console.log("[Shopping] ?��??�체 ?�용:", script)
      
      // ?�본을 그�?�??�용 (?�처�??�이 ?�본 그�?�?
      // ?��? ?�본을 ?�정?�거???�르지 ?�음
      const ttsText = script.trim()
      
      console.log("[Shopping] TTS???�달???��?길이:", ttsText.length, "??)
      console.log("[Shopping] TTS???�달???��??�용:", ttsText)
      
      let response: Response
      const resolveSpeed = () => {
        if (selectedVoiceId?.startsWith("elevenlabs-")) {
          return Math.min(1.5, Math.max(0.8, Math.round(ttsSpeed * 10) / 10))
        }
        if (selectedVoiceId?.startsWith("supertonic-")) {
          return Math.min(2, Math.max(0.7, Math.round(ttsSpeed * 100) / 100))
        }
        return Math.min(2, Math.max(0.5, Math.round(ttsSpeed * 10) / 10))
      }
      const speed = resolveSpeed()

      if (selectedVoiceId?.startsWith("supertonic-")) {
        const voiceId = selectedVoiceId.replace("supertonic-", "")
        response = await fetch("/api/supertonic-tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: ttsText, voiceId, speed, lang: "ko" }),
        })
      } else if (selectedVoiceId?.startsWith("supertone-")) {
        const voiceId = selectedVoiceId.replace("supertone-", "")
        const supertoneApiKey =
          typeof window !== "undefined"
            ? (localStorage.getItem("shotform_supertone_api_key") || "").trim()
            : null

        if (!supertoneApiKey) {
          alert("?�퍼??API ?��? ?�요?�니?? ?�정?�서 API ?��? ?�력?�주?�요.")
          setIsGeneratingTTS(false)
          return
        }

        response = await fetch("/api/supertone-tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: ttsText,
            voiceId,
            apiKey: supertoneApiKey,
            style: selectedSupertoneStyle || "neutral",
            language: "ko",
            speed,
          }),
        })
      } else if (selectedVoiceId?.startsWith("typecast-")) {
        const voiceId = selectedVoiceId.replace("typecast-", "")
        const typecastApiKey =
          typeof window !== "undefined"
            ? (
                localStorage.getItem("shotform_typecast_api_key") ||
                localStorage.getItem("typecast_api_key") ||
                ""
              ).trim()
            : ""

        if (!typecastApiKey) {
          alert("?�?�캐?�트 API ?��? ?�요?�니?? ?�정?�서 API ?��? ?�력?�주?�요.")
          setIsGeneratingTTS(false)
          return
        }

        response = await fetch("/api/typecast-tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: ttsText,
            voiceId,
            apiKey: typecastApiKey,
            emotion: selectedSupertoneStyle || "normal",
            speed,
          }),
        })
      } else if (selectedVoiceId?.startsWith("ttsmaker-")) {
        alert("TTSMaker?????�상 지?�하지 ?�습?�다. SuperTone / ElevenLabs / ?�?�캐?�트 / Supertonic???�택?�주?�요.")
        setIsGeneratingTTS(false)
        return
      } else {
        // ElevenLabs (기본)
        const voiceId = (selectedVoiceId || "elevenlabs-jB1Cifc2UQbq1gR3wnb0").replace("elevenlabs-", "")
        const elevenlabsApiKey =
          typeof window !== "undefined"
            ? (localStorage.getItem("shotform_elevenlabs_api_key") || "").trim()
            : null

        if (!elevenlabsApiKey) {
          alert("ElevenLabs API ?��? ?�요?�니?? ?�정?�서 API ?��? ?�력?�주?�요.")
          setIsGeneratingTTS(false)
          return
        }

        response = await fetch("/api/elevenlabs-tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: ttsText,
            voiceId,
            apiKey: elevenlabsApiKey,
            speed,
          }),
        })
      }

      if (!response.ok) {
        let errorMessage = "TTS ?�성 ?�패"
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
      
      console.log("[Shopping] TTS API ?�답:", {
        hasAudioBase64: !!data.audioBase64,
        hasAudioUrl: !!data.audioUrl,
        success: data.success,
        error: data.error,
      })
      
      if (data.success === false) {
        throw new Error(data.error || "TTS ?�성???�패?�습?�다.")
      }
      
      if (!data.audioBase64 && !data.audioUrl) {
        throw new Error(`TTS ?�답???�디???�이?��? ?�습?�다. ?�답: ${JSON.stringify(data)}`)
      }

      // Base64�?Blob?�로 변??      let audioBlob: Blob
      if (data.audioBase64) {
        const audioBytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0))
        audioBlob = new Blob([audioBytes], { type: "audio/mpeg" })
      } else if (data.audioUrl) {
        const audioResponse = await fetch(data.audioUrl)
        audioBlob = await audioResponse.blob()
      } else {
        throw new Error("?�디???�이?��? 찾을 ???�습?�다.")
      }

      // 1.5배속 처리 (?�치 ?��?)
      console.log("[Shopping] ?�디??1.5배속 처리 ?�작 (?�치 ?��?)...")
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const arrayBuffer = await audioBlob.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      
      // ?�본 ?�디???�보 ?�인
      const originalDuration = audioBuffer.duration
      const originalSampleRate = audioBuffer.sampleRate
      const originalLength = audioBuffer.length
      
      console.log("[Shopping] ?�본 ?�디???�보:", {
        길이: originalDuration.toFixed(3) + "�?,
        ?�플?? originalLength,
        ?�플?�이?? originalSampleRate + "Hz",
        채널?? audioBuffer.numberOfChannels
      })
      
      // 1배속?�로 ?�용 (배속 처리 ?�이 ?�본 그�?�??�용)
      // ?�본 ?�디?��? 그�?�?WAV�?변?�하???�체 ?�본이 모두 ?�함?�도�???      console.log("[Shopping] ?�디?��? 1배속?�로 처리 (?�본 그�?�??�용, ?�체 ?��??�함)...")
      
      // WAV�?변??(?�본 그�?�??�용)
      console.log("[Shopping] WAV 변???�작...")
      const wavBuffer = audioBufferToWav(audioBuffer) // ?�본 audioBuffer ?�용
      const processedBlob = new Blob([wavBuffer], { type: "audio/wav" })
      
      console.log("[Shopping] ???�디??처리 ?�료 (1배속, ?�본 그�?�? ?�체 ?��??�함)")
      console.log("[Shopping] WAV Blob ?�기:", processedBlob.size, "bytes")
      console.log("[Shopping] 최종 ?�디???�보:", {
        ?�본_길이: originalDuration.toFixed(3) + "�?,
        처리_??길이: originalDuration.toFixed(3) + "�?(변�??�음, ?�체 ?��??�함)",
        WAV_?�기: (processedBlob.size / 1024).toFixed(2) + "KB"
      })
      
      // ?�제 ?�디??길이 (?�본 그�?�? ?�용
      const actualAudioDuration = originalDuration
      
      // ?�시 URL ?�성 (미리?�기??
      const tempAudioUrl = URL.createObjectURL(processedBlob)
      console.log("[Shopping] ?�시 ?�디??URL ?�성:", tempAudioUrl)
      
      // Supabase Storage???�디???�일 ?�로??(?�구 ?�??
      let permanentAudioUrl = tempAudioUrl // 기본�? ?�시 URL
      try {
        if (userId && currentProject?.id) {
          console.log("[Shopping] ?�디???�일??Supabase Storage???�로??�?..")
          permanentAudioUrl = await uploadTTSAudio(processedBlob, currentProject.id, userId)
          console.log("[Shopping] ?�디???�일 ?�로???�료:", permanentAudioUrl)
        } else {
          console.warn("[Shopping] ?�로?�트가 ?�어 ?�디???�일???�로?�하지 ?�습?�다. ?�로?�트�?먼�? ?�?�해주세??")
        }
      } catch (uploadError) {
        console.error("[Shopping] ?�디???�일 ?�로???�패:", uploadError)
        // ?�로???�패?�도 ?�시 URL ?�용 (?�용??경험 ?��?)
      }
      
      // TTS ?�디??URL ?�정 (?�구 URL ?�선, ?�으�??�시 URL)
      setTtsAudioUrl(permanentAudioUrl)
      console.log("[Shopping] TTS ?�디??URL ?�정 ?�료:", permanentAudioUrl ? "?�음" : "?�음")
      
      // ?�제 ?�디??길이??맞춰 scriptLines ?�간 ?�보 ?�성/?�조??      // 3�??�면?�로 ?�누�?(scenes가 ?�으�??�성)
      let sceneTexts = scenes.length > 0 ? scenes : await splitScriptIntoScenes(script)
      if (scenes.length === 0) {
        setScenes(sceneTexts)
      }
      
      // �??�면??문장 ?�위�??�누??scriptLines ?�성
      const lines: ScriptLine[] = []
      let currentTime = 0
      
      // ?�제 ?�디??길이??맞춰 ?�간 분배
      const totalCharacters = script.length
      
      for (let i = 0; i < sceneTexts.length; i++) {
        const scene = sceneTexts[i]
        const sentences = scene.split(/[.!??�！�?\s*/).filter(s => s.trim().length > 0)
        
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
      console.log("[Shopping] scriptLines ?�간 ?�보 ?�성 ?�료 (?�제 ?�디??길이 기반)")
      
      setTtsProgress({ current: 1, total: 1 })
      
      alert(`TTS ?�성???�료?�었?�니?? (?�제 길이: ${actualAudioDuration.toFixed(1)}�?`)
    } catch (error) {
      console.error("TTS ?�성 ?�패:", error)
      setError(`TTS ?�성???�패?�습?�다: ${error instanceof Error ? error.message : "?????�는 ?�류"}`)
    } finally {
      setIsGeneratingTTS(false)
    }
  }

  // ?��?지 1개만 ?�성 (?�상?� 미리보기 버튼?�서)
  // ?��?지 ?�성 ?�계�??�동 (?�제 ?�성?� ?��? ?�음)
  const handleGoToImageGeneration = () => {
    if (!script.trim()) {
      alert("?�본이 ?�성?��? ?�았?�니??")
      return
    }
    setActiveStep("video")
    // ?�롬?�트 초기??    setImagePrompts([])
    setPromptsGenerated(false)
    // ?�상 ?�성 ?�태 초기??(?�계 ?�환 ??
    setIsConvertingToVideo(new Map())
  }

  // ?��?지 ?�롬?�트 ?�성 ?�수
  const handleGenerateImagePrompts = async () => {
    if (!script.trim()) {
      alert("?�본이 ?�성?��? ?�았?�니??")
      return
    }

    const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined

    if (!openaiApiKey) {
      alert("OpenAI API ?��? ?�요?�니?? 메인 ?�면???�정(?�니바�??�이�??�서 API ?��? ?�력?�주?�요.")
      return
    }

    setIsGeneratingPrompts(true)
    setError("")

    try {
      // ?��?지�?base64�?변??(?�는 경우)
      let imageBase64: string | undefined = undefined
      if (productImage) {
        imageBase64 = productImage
      }

      // ?��??�체�?분석?�여 ?��?지 ?�롬?�트 ?�성 (1�??��?지??
      const prompts = await generateImagePromptsFromScript(
        script, // ?��??�체 ?�달
        productName,
        productDescription || "",
        imageBase64,
        openaiApiKey,
        animalCharacter
      )
      
      setImagePrompts(prompts)
      setPromptsGenerated(true)
    } catch (error) {
      console.error("?�롬?�트 ?�성 ?�패:", error)
      setError(`?�롬?�트 ?�성???�패?�습?�다: ${error instanceof Error ? error.message : "?????�는 ?�류"}`)
    } finally {
      setIsGeneratingPrompts(false)
    }
  }

  // ?�제 ?��?지 ?�성 ?�수 (?�롬?�트 ?�용)
  const handleGenerateImage = async () => {
    if (!script.trim()) {
      alert("?�본이 ?�성?��? ?�았?�니??")
      return
    }

    if (!promptsGenerated || imagePrompts.length === 0) {
      alert("먼�? ?��?지 ?�롬?�트�??�성?�주?�요.")
      return
    }

    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined

    if (!replicateApiKey) {
      alert("Replicate API ?��? ?�요?�니?? 메인 ?�면???�정(?�니바�??�이�??�서 API ?��? ?�력?�주?�요.")
      return
    }

    setIsGeneratingVideo(true)
    setError("")
    setImageUrls([]) // ?�생????기존 ?��?지 초기??    setGenerationProgress({ current: 0, total: 3 })

    try {
      // ?��?지�?base64�?변??(?�는 경우)
      let imageBase64: string | undefined = undefined
      let imageAspectRatio: string | undefined = undefined
      
      if (productImage) {
        imageBase64 = productImage
        
        // ?�본 ?��?지 비율 계산
        try {
          const img = new Image()
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              const width = img.width
              const height = img.height
              const ratio = width / height
              
              // 비율???�라 ?�절??aspect_ratio ?�정
              if (Math.abs(ratio - 1) < 0.1) {
                // 1:1 (?�사각형)
                imageAspectRatio = "1:1"
              } else if (ratio > 1.2) {
                // 가로�? ??�?경우
                imageAspectRatio = "16:9"
              } else if (ratio < 0.7) {
                // ?�로가 ??�?경우
                imageAspectRatio = "9:16"
              } else {
                // 중간 비율
                imageAspectRatio = ratio > 1 ? "4:3" : "3:4"
              }
              console.log(`[Shopping] ?�본 ?��?지 비율 계산: ${width}x${height} = ${ratio.toFixed(2)}, aspect_ratio: ${imageAspectRatio}`)
              resolve()
            }
            img.onerror = () => {
              console.warn("[Shopping] ?��?지 비율 계산 ?�패, 기본�?9:16 ?�용")
              imageAspectRatio = "9:16"
              resolve()
            }
            img.src = productImage
          })
        } catch (error) {
          console.error("[Shopping] ?��?지 비율 계산 �??�류:", error)
          imageAspectRatio = "9:16" // 기본�?        }
      }

      // ?�롬?�트�??�용?�여 3?�의 ?��?지 ?�성
      const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined
      
      const imageUrls = await generateImage(script, productName, replicateApiKey, imageBase64, productDescription, openaiApiKey, imagePrompts, imageAspectRatio, animalCharacter)
      
      setImageUrls(imageUrls)
      setGenerationProgress({ current: 3, total: 3 })
      // ?��?지 ?�성 ?�료 ?�에??"video" ?�계??머물?�서 ?�본�??�성???��?지�?비교?????�도�???    } catch (error) {
      console.error("?��?지 ?�성 ?�패:", error)
      setError(`?��?지 ?�성???�패?�습?�다: ${error instanceof Error ? error.message : "?????�는 ?�류"}`)
    } finally {
      setIsGeneratingVideo(false)
      setGenerationProgress({ current: 0, total: 1 })
    }
  }

  // 개별 ?��?지 ?�생???�수
  const handleRegenerateSingleImage = async (index: 0 | 1 | 2) => {
    // 즉시 로딩 ?�태 ?�정 (버튼 ?�릭 ??바로 로딩 ?�시)
    setIsRegeneratingImage((prev) => {
      const newMap = new Map(prev)
      newMap.set(index, true)
      return newMap
    })
    
    if (!script.trim()) {
      alert("?�본이 ?�성?��? ?�았?�니??")
      setIsRegeneratingImage((prev) => {
        const newMap = new Map(prev)
        newMap.set(index, false)
        return newMap
      })
      return
    }

    if (!promptsGenerated || imagePrompts.length === 0) {
      alert("먼�? ?��?지 ?�롬?�트�??�성?�주?�요.")
      setIsRegeneratingImage((prev) => {
        const newMap = new Map(prev)
        newMap.set(index, false)
        return newMap
      })
      return
    }

    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined

    if (!replicateApiKey) {
      alert("Replicate API ?��? ?�요?�니?? 메인 ?�면???�정(?�니바�??�이�??�서 API ?��? ?�력?�주?�요.")
      setIsRegeneratingImage((prev) => {
        const newMap = new Map(prev)
        newMap.set(index, false)
        return newMap
      })
      return
    }

    const sceneNames = ["?�품 ?�체 ??, "?�품 ?�테????, "?�른 배경 ??]
    
    try {
      setError("")
      
      console.log(`[Shopping] ?���?${sceneNames[index]} ?�생???�작`)
      
      // ?��?지�?base64�?변??(?�는 경우)
      let imageBase64: string | undefined = undefined
      let imageAspectRatio: string | undefined = undefined
      
      if (productImage) {
        imageBase64 = productImage
        
        // ?�본 ?��?지 비율 계산
        try {
          const img = new Image()
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              const width = img.width
              const height = img.height
              const ratio = width / height
              
              // 비율???�라 ?�절??aspect_ratio ?�정
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
          console.error("[Shopping] ?��?지 비율 계산 �??�류:", error)
          imageAspectRatio = "9:16"
        }
      }

      // ?�당 ?�덱?�의 ?�롬?�트�??��?지 ?�생??      const prompt = imagePrompts[index]
      
      // 추�? ?�롬?�트가 ?�으�?AI�??�해 ?�롬?�트 ?�작??      const customPrompt = customImagePrompts.get(index)
      let finalPrompt = prompt.prompt
      
      if (customPrompt && customPrompt.trim()) {
        console.log(`[Shopping] 추�? ?�롬?�트 감�?, AI�??�해 ?�롬?�트 ?�작???�작: ${customPrompt}`)
        
        const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined
        
        if (openaiApiKey) {
          // AI�??�해 ?�롬?�트 ?�작??          finalPrompt = await refineImagePromptWithCustomInput(
            prompt.prompt,
            customPrompt,
            productName,
            productDescription,
            openaiApiKey
          )
          console.log(`[Shopping] ??AI가 ?�작?�한 ?�롬?�트: ${finalPrompt.substring(0, 100)}...`)
        } else {
          // API ?��? ?�으�??�순???�결
          finalPrompt = `${prompt.prompt}, ${customPrompt.trim()}`
          console.log(`[Shopping] OpenAI API ???�음, ?�순 ?�결 ?�용`)
        }
      }
      
      const imageUrl = await generateImageWithNanobanana(
        finalPrompt,
        productName,
        imageBase64,
        replicateApiKey,
        index, // sceneIndex
        productDescription,
        imageAspectRatio,
        animalCharacter
      )
      
      console.log(`[Shopping] ??${sceneNames[index]} ?�생???�료:`, imageUrl)
      
      // ?�생?�된 ?��?지 URL ?�데?�트
      setImageUrls((prev) => {
        const newUrls = [...prev]
        newUrls[index] = imageUrl
        return newUrls
      })
      
      // ?�당 ?�덱?�의 ?�상???�다�?초기??(?��?지가 변경되?�으므�?
      setConvertedVideoUrls((prev) => {
        const newMap = new Map(prev)
        newMap.delete(index)
        return newMap
      })
      
    } catch (error) {
      console.error(`[Shopping] ??${sceneNames[index]} ?�생???�패:`, error)
      setError(`?��?지 ?�생?�에 ?�패?�습?�다: ${error instanceof Error ? error.message : "?????�는 ?�류"}`)
    } finally {
      // ?�태 ?�데?�트
      setIsRegeneratingImage((prev) => {
        const newMap = new Map(prev)
        newMap.set(index, false)
        return newMap
      })
    }
  }

  // 미리보기 버튼 ?�릭 ???�상 ?�성 �?미리보기 준�?(?�거??- ?�용 ????
  const handleGenerateVideoFromImage = async () => {
    // ???�수?????�상 ?�용?��? ?�음
    // handleConvertAllImagesToVideos�??�용?�야 ??    alert("?��?지 ?�상 변??기능???�용?�주?�요.")
  }

  // 미리보기 초기??(?�성???�상 + TTS + ?�막)
  const initializePreview = async (generatedVideoUrl: string) => {
    if (!ttsAudioUrl || !canvasRef.current) {
      console.warn("TTS ?�는 캔버?��? 준비되지 ?�았?�니??")
      return
    }

    try {
      // ?�디??로드
      const audio = new Audio(ttsAudioUrl)
      audio.crossOrigin = "anonymous"
      
      await new Promise<void>((resolve, reject) => {
        audio.oncanplaythrough = () => resolve()
        audio.onerror = (e) => reject(e)
        audio.load()
      })
      
      setPreviewAudio(audio)
      
      // 비디??로드
      const video = document.createElement("video")
      video.src = generatedVideoUrl
      video.crossOrigin = "anonymous"
      video.preload = "auto"
      video.muted = true // ?�소�?(TTS�?별도�??�생)
      video.loop = true // 루프 (TTS 길이??맞춰 반복)
      
      await new Promise<void>((resolve, reject) => {
        video.oncanplaythrough = () => resolve()
        video.onerror = (e) => reject(e)
        video.load()
      })
      
      setPreviewVideoElements([video])
      
      // 캔버?�에 �??�레??그리�?(비율 ?��?)
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
          
          // 비디?��? 캔버?�의 비율 계산
          const videoAspect = videoWidth / videoHeight
          const canvasAspect = canvasWidth / canvasHeight
          
          let drawWidth = canvasWidth
          let drawHeight = canvasHeight
          let drawX = 0
          let drawY = 0
          
          // 비율??맞춰 중앙 ?�롭 (cover 방식)
          if (videoAspect > canvasAspect) {
            // 비디?��? ???�음 - ?�이??맞추�?좌우 ?�롭
            drawHeight = canvasHeight
            drawWidth = drawHeight * videoAspect
            drawX = (canvasWidth - drawWidth) / 2
          } else {
            // 비디?��? ???�음 - ?�비??맞추�??�하 ?�롭
            drawWidth = canvasWidth
            drawHeight = drawWidth / videoAspect
            drawY = (canvasHeight - drawHeight) / 2
          }
          
          ctx.drawImage(video, 0, 0, videoWidth, videoHeight, drawX, drawY, drawWidth, drawHeight)
        }
      }
      
      console.log("[Shopping] 미리보기 준�??�료")
    } catch (error) {
      console.error("[Shopping] 미리보기 준�??�패:", error)
      setError(`미리보기 준비에 ?�패?�습?�다: ${error instanceof Error ? error.message : "?????�는 ?�류"}`)
    }
  }

  // ?�네???�성 (AI)
  const handleGenerateThumbnail = async () => {
    if (!productName) {
      alert("?�품명이 ?�요?�니??")
      return
    }

    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined
    const gptApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined

    if (!replicateApiKey) {
      alert("Replicate API ?��? ?�요?�니?? 메인 ?�면???�정(?�니바�??�이�??�서 API ?��? ?�력?�주?�요.")
      return
    }

    setIsGeneratingThumbnail(true)
    setError("")

    try {
      // ?�품 ?��?지가 ?�으�?base64�?변??      let imageBase64: string | undefined = undefined
      if (productImage) {
        imageBase64 = productImage
      }

      // 1. ?�킹 문구 ?�성
      const hookingText = await generateThumbnailHookingText(productName, gptApiKey)
      setThumbnailHookingText(hookingText)

      // 2. ?�품 ?��?지 ?�인
      if (!imageBase64) {
        throw new Error("?�품 ?��?지가 ?�요?�니??")
      }

      // 3. ?�노바나?�로 ?�네???�성 (?�품 ?��?지 + ?�스???�함)
      const thumbnail = await generateShortsThumbnail(productName, replicateApiKey, imageBase64, hookingText)
      
      // 4. ?�네??목록??추�?
      const newThumbnail = {
        url: thumbnail,
        text: hookingText,
        isCustom: false
      }
      setThumbnailImages(prev => [...prev, newThumbnail])
      setSelectedThumbnailIndex(thumbnailImages.length)
      setThumbnailUrl(thumbnail)

      // 5. ?�성???�네?�을 캔버?�에 ?�시 (AI ?�성 ?�네?��? ?��? ?�스?��? ?�함?�어 ?�으므�?그�?�??�시)
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
              // 비율 ?��??�며 그리�?              const imgAspect = img.width / img.height
              const canvasAspect = canvas.width / canvas.height
              
              let drawWidth: number
              let drawHeight: number
              let offsetX: number
              let offsetY: number
              
              if (imgAspect > canvasAspect) {
                // ?��?지가 ???�음 - ?�이??맞추�?좌우 ?�롭
                drawHeight = canvas.height
                drawWidth = drawHeight * imgAspect
                offsetX = (canvas.width - drawWidth) / 2
                offsetY = 0
              } else {
                // ?��?지가 ???�음 - ?�비??맞추�??�하 ?�롭
                drawWidth = canvas.width
                drawHeight = drawWidth / imgAspect
                offsetX = 0
                offsetY = (canvas.height - drawHeight) / 2
              }
              
              // 검?� 배경?�로 채우�?              ctx.fillStyle = "black"
              ctx.fillRect(0, 0, canvas.width, canvas.height)
              
              // ?��?지 그리�?(비율 ?��?)
              ctx.drawImage(img, 0, 0, img.width, img.height, offsetX, offsetY, drawWidth, drawHeight)
            }
          }
        }
      }, 100)
    } catch (error) {
      console.error("?�네???�성 ?�패:", error)
      setError(`?�네???�성???�패?�습?�다: ${error instanceof Error ? error.message : "?????�는 ?�류"}`)
    } finally {
      setIsGeneratingThumbnail(false)
    }
  }

  // 직접 ?�네???��?지 ?�로??  const handleCustomThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      alert("?��?지 ?�일�??�로??가?�합?�다.")
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string
      setCustomThumbnailImage(imageUrl)
      
      // ?�킹 문구 ?�동 ?�성 (?�택?�항)
      if (!customThumbnailText.line1) {
        const gptApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined
        if (gptApiKey) {
          generateThumbnailHookingText(productName, gptApiKey).then(text => {
            setCustomThumbnailText(text)
          }).catch(() => {
            // ?�패?�도 계속 진행
          })
        }
      }
    }
    reader.readAsDataURL(file)
  }

  // ?��?지 ?�성 ?�계?�서 ?�성???��?지 ?�택
  const handleSelectGeneratedImage = (imageUrl: string) => {
    setCustomThumbnailImage(imageUrl)
    
    // ?�킹 문구 ?�동 ?�성 (?�택?�항)
    if (!customThumbnailText.line1) {
      const gptApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined
      if (gptApiKey) {
        generateThumbnailHookingText(productName, gptApiKey).then(text => {
          setCustomThumbnailText(text)
        }).catch(() => {
          // ?�패?�도 계속 진행
        })
      }
    }
  }

  // 직접 ?�성???�네?�에 ?�스??추�? �??�??  const handleSaveCustomThumbnail = () => {
    if (!customThumbnailImage) {
      alert("?��?지�??�로?�해주세??")
      return
    }

    if (!customThumbnailText.line1 || !customThumbnailText.line2) {
      alert("?�스?��? ?�력?�주?�요.")
      return
    }

    // 캔버?�에 ?��?지?� ?�스??그리�?    renderThumbnailWithText(customThumbnailImage, customThumbnailText).then(() => {
      // 캔버?�에???�이??URL 가?�오�?      if (thumbnailCanvasRef.current) {
        const dataUrl = thumbnailCanvasRef.current.toDataURL("image/png")
        
        // ?�네??목록??추�?
        const newThumbnail = {
          url: dataUrl,
          text: customThumbnailText,
          isCustom: true
        }
        setThumbnailImages(prev => [...prev, newThumbnail])
        setSelectedThumbnailIndex(thumbnailImages.length)
        setThumbnailUrl(dataUrl)
        
        // 초기??        setCustomThumbnailImage("")
        setCustomThumbnailText({ line1: "", line2: "" })
      }
    })
  }

  // ?�네???�택
  const handleSelectThumbnail = (index: number) => {
    setSelectedThumbnailIndex(index)
    const selected = thumbnailImages[index]
    if (selected) {
      setThumbnailUrl(selected.url)
      setThumbnailHookingText(selected.text)
      
      // AI ?�성 ?�네?��? ?��? ?�스?��? ?�함?�어 ?�으므�?그�?�??�시
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
              // 비율 ?��??�며 그리�?              const imgAspect = img.width / img.height
              const canvasAspect = canvas.width / canvas.height
              
              let drawWidth: number
              let drawHeight: number
              let offsetX: number
              let offsetY: number
              
              if (imgAspect > canvasAspect) {
                // ?��?지가 ???�음 - ?�이??맞추�?좌우 ?�롭
                drawHeight = canvas.height
                drawWidth = drawHeight * imgAspect
                offsetX = (canvas.width - drawWidth) / 2
                offsetY = 0
              } else {
                // ?��?지가 ???�음 - ?�비??맞추�??�하 ?�롭
                drawWidth = canvas.width
                drawHeight = drawWidth / imgAspect
                offsetX = 0
                offsetY = (canvas.height - drawHeight) / 2
              }
              
              // 검?� 배경?�로 채우�?              ctx.fillStyle = "black"
              ctx.fillRect(0, 0, canvas.width, canvas.height)
              
              // ?��?지 그리�?(비율 ?��?)
              ctx.drawImage(img, 0, 0, img.width, img.height, offsetX, offsetY, drawWidth, drawHeight)
            }
          }
        }
      } else {
        // 직접 ?�성 ?�네?��? ?�스?��? ?�더�?        renderThumbnailWithText(selected.url, selected.text)
      }
    }
  }

  // ?�네?�에 ?�스???�더�?  const renderThumbnailWithText = async (imageUrl: string, hookingText: { line1: string; line2: string }): Promise<void> => {
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

      // 캔버???�기 ?�정 (9:16 비율)
      canvas.width = 1080
      canvas.height = 1920

      // ?��?지 로드
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.src = imageUrl

      img.onload = () => {
        // 배경 ?��?지 그리�?(비율 ?��??�며 ?��? - cover 방식)
        const imgAspect = img.width / img.height
        const canvasAspect = canvas.width / canvas.height
        
        // ?��?지 ?��????�용
        let drawWidth: number
        let drawHeight: number
        let offsetX: number
        let offsetY: number
        
        // 비율???��??�면???��? (cover 방식)
        if (imgAspect > canvasAspect) {
          // ?��?지가 ???�음 - ?�이??맞추�?좌우 ?�롭
          drawHeight = canvas.height * customThumbnailTextStyle.imageScale
          drawWidth = drawHeight * imgAspect
          offsetX = (canvas.width - drawWidth) / 2
          offsetY = (canvas.height - drawHeight) / 2
        } else {
          // ?��?지가 ???�음 - ?�비??맞추�??�하 ?�롭
          drawWidth = canvas.width * customThumbnailTextStyle.imageScale
          drawHeight = drawWidth / imgAspect
          offsetX = (canvas.width - drawWidth) / 2
          offsetY = (canvas.height - drawHeight) / 2
        }
        
        // 검?� 배경?�로 채우�?        ctx.fillStyle = "black"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        // ?��?지 그리�?(비율 ?��?)
        ctx.drawImage(img, 0, 0, img.width, img.height, offsetX, offsetY, drawWidth, drawHeight)

        // ?�스???�치 (?�용???�정???�라)
        const textY = canvas.height * customThumbnailTextStyle.position
        const textX = canvas.width / 2

        // �?번째 �??��???(글???�기: customThumbnailTextStyle.fontSize)
        const fontSize = customThumbnailTextStyle.fontSize ?? 100
        ctx.font = `bold ${fontSize}px 'Noto Sans KR', Arial, sans-serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        
        // �?번째 �??�전 ?�용
        ctx.save()
        ctx.translate(textX, textY)
        ctx.rotate((customThumbnailTextStyle.textRotation * Math.PI) / 180)
        
        // �?번째 �??�두�?        if (customThumbnailTextStyle.strokeWidth > 0) {
          ctx.strokeStyle = customThumbnailTextStyle.strokeColor
          ctx.lineWidth = customThumbnailTextStyle.strokeWidth
          ctx.lineJoin = "round"
          ctx.strokeText(hookingText.line1, 0, 0)
        }
        
        // �?번째 �??�스??        ctx.fillStyle = customThumbnailTextStyle.line1Color
        ctx.fillText(hookingText.line1, 0, 0)
        ctx.restore()

        // ??번째 �??��???(�?줄과 ?�일 ?�기, �?간격?� 글???�기??1.2�?
        const textY2 = textY + fontSize * 1.2
        
        // ??번째 �??�전 ?�용
        ctx.save()
        ctx.translate(textX, textY2)
        ctx.rotate((customThumbnailTextStyle.textRotation * Math.PI) / 180)
        
        // ??번째 �??�두�?        if (customThumbnailTextStyle.strokeWidth > 0) {
          ctx.strokeStyle = customThumbnailTextStyle.strokeColor
          ctx.lineWidth = customThumbnailTextStyle.strokeWidth
          ctx.strokeText(hookingText.line2, 0, 0)
        }
        
        // ??번째 �??�스??        ctx.fillStyle = customThumbnailTextStyle.line2Color
        ctx.fillText(hookingText.line2, 0, 0)
        ctx.restore()
        
        resolve()
      }

      img.onerror = () => {
        resolve()
      }
    })
  }

  // ?�네???�운로드 (캔버?�에??
  const handleDownloadThumbnail = () => {
    const canvas = thumbnailCanvasRef.current
    if (!canvas) {
      alert("?�네?�이 ?�성?��? ?�았?�니??")
      return
    }
    
    try {
      const dataUrl = canvas.toDataURL("image/png")
      const a = document.createElement("a")
      a.href = dataUrl
      a.download = `${productName}_?�츠_?�네??png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (error) {
      console.error("?�네???�운로드 ?�패:", error)
      alert("?�네???�운로드???�패?�습?�다.")
    }
  }

  // 미리보기 초기??�??�생
  const handlePreview = async () => {
    // Map??배열�?변??(?�덱???�서?��?
    const videoUrlsArray: string[] = []
    for (let i = 0; i < imageUrls.length; i++) {
      const videoUrl = convertedVideoUrls.get(i)
      if (!videoUrl) {
        alert(`?�면 ${i + 1}???�상???�직 변?�되지 ?�았?�니??`)
        return
      }
      videoUrlsArray.push(videoUrl)
    }

    if (videoUrlsArray.length === 0 || !ttsAudioUrl || !canvasRef.current) {
      alert("변?�된 ?�상�?TTS가 모두 준비되?�야 ?�니??")
      return
    }

    setError("")
    try {
      console.log("[Shopping] 미리보기 ?�작")

      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        throw new Error("Canvas context�??�성?????�습?�다.")
      }

      // Canvas ?�기�?1080x1920?�로 ?�정
      canvas.width = 1080
      canvas.height = 1920

      // ?��? 로드???�디?��? 비디?��? ?�으�??�사??      let audio: HTMLAudioElement | null = previewAudio
      let bgmAudio: HTMLAudioElement | null = null
      let videoElements = previewVideoElements

      // ?�디?��? ?�거???�효?��? ?�으�??�로 로드
      if (!audio || !audio.duration || isNaN(audio.duration)) {
        console.log("[Shopping] ?�디???�로 로드")
        const audioResponse = await fetch(ttsAudioUrl)
        const audioBlob = await audioResponse.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        audio = new Audio(audioUrl)
        audio.volume = ttsVolume // TTS 볼륨 ?�정

        await new Promise<void>((resolve, reject) => {
          if (!audio) {
            reject(new Error("?�디???�성 ?�패"))
            return
          }
          audio.onloadeddata = () => resolve()
          audio.onerror = reject
        })
        setPreviewAudio(audio)
      } else {
        console.log("[Shopping] 기존 ?�디???�사??)
        // 기존 ?�디???�사?????�간 초기??�?볼륨 ?�정
        audio.currentTime = 0
        audio.pause()
        audio.volume = ttsVolume
      }

      if (!audio) {
        throw new Error("?�디?��? 로드?????�습?�다.")
      }

      // BGM 로드 (?�는 경우)
      let sfxAudio: HTMLAudioElement | null = null
      if (bgmUrl) {
        // ?�로??BGM??만들�??�에 ?�전 BGM ?�리
        if (previewBgmAudio) {
          console.log("[Shopping] ?�전 BGM ?�리")
          previewBgmAudio.pause()
          previewBgmAudio.currentTime = 0
          previewBgmAudio.src = "" // ?�디???�스 ?�거
          previewBgmAudio.load() // ?�디??리소???�제
          setPreviewBgmAudio(null)
        }
        
        console.log("[Shopping] BGM 로드")
        bgmAudio = new Audio(bgmUrl)
        bgmAudio.volume = bgmVolume
        bgmAudio.loop = false // ?�간?�??맞게 ?�생?��?�?loop ?�제
        
        await new Promise<void>((resolve, reject) => {
          if (!bgmAudio) {
            reject(new Error("BGM ?�성 ?�패"))
            return
          }
          bgmAudio.onloadeddata = () => {
            // BGM??timeupdate ?�벤?�로 종료 ?�간 체크 (추�? 보호)
            const currentBgmAudio = bgmAudio // ?�로?�?�서 ?�전?�게 ?�근?�기 ?�해 로컬 변?�에 ?�??            if (currentBgmAudio) {
              currentBgmAudio.addEventListener("timeupdate", () => {
                if (previewAudio && currentBgmAudio && !currentBgmAudio.paused) {
                const elapsed = previewAudio.currentTime
                  // 종료 ?�간???�달?�거???�어갔거???�디?��? ?�났?�면 즉시 ?��? (?�격??체크)
                  if (elapsed >= bgmEndTime || elapsed < bgmStartTime || elapsed >= previewAudio.duration || previewAudio.ended) {
                    console.log(`[Shopping] BGM timeupdate ?�벤?�에???��?: elapsed=${elapsed.toFixed(2)}�? bgmEndTime=${bgmEndTime}�?)
                    currentBgmAudio.pause()
                    currentBgmAudio.currentTime = 0
                  }
                }
              })
              // BGM???�났???�도 체크?�여 ?�생 ?�간?��??�었?�면 ?�생?��? ?�음
              currentBgmAudio.addEventListener("ended", () => {
                if (previewAudio) {
                  const elapsed = previewAudio.currentTime
                  // BGM ?�체가 ?�났?�도 메인 ?�디???�간??체크?�여 종료 ?�간???�었?�면 ?�생?��? ?�음
                  if (elapsed >= bgmEndTime || elapsed < bgmStartTime || elapsed >= previewAudio.duration || previewAudio.ended) {
                    console.log(`[Shopping] BGM ended ?�벤?? ?�생 ?�간?� 밖이므�??�생?��? ?�음, elapsed=${elapsed.toFixed(2)}�? bgmEndTime=${bgmEndTime}�?)
                    currentBgmAudio.pause()
                    currentBgmAudio.currentTime = 0
                  } else if (elapsed >= bgmStartTime && elapsed < bgmEndTime && elapsed < previewAudio.duration && !previewAudio.ended) {
                    // ?�생 ?�간?� ?�에 ?�으�??�시 ?�생 (루프)
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
              // previewBgmAudio가 ?�정???�에??ended ?�벤?��? 추�??�여 종료 ?�간 체크
              // ?�는 BGM???�체?�으�??�났???�도 메인 ?�디???�간??체크?�기 ?�함
              const bgmEndedHandler = () => {
                if (previewAudio && currentBgmAudio) {
                  const elapsed = previewAudio.currentTime
                  // BGM ?�체가 ?�났?�도 메인 ?�디???�간??체크?�여 종료 ?�간???�었?�면 ?�생?��? ?�음
                  if (elapsed >= bgmEndTime || elapsed < bgmStartTime || elapsed >= previewAudio.duration || previewAudio.ended) {
                    console.log(`[Shopping] ??BGM ended ?�벤??(previewBgmAudio): ?�생 ?�간?� 밖이므�??�생?��? ?�음, elapsed=${elapsed.toFixed(2)}�? bgmEndTime=${bgmEndTime}�?)
                    currentBgmAudio.pause()
                    currentBgmAudio.currentTime = 0
                  } else if (elapsed >= bgmStartTime && elapsed < bgmEndTime && elapsed < previewAudio.duration && !previewAudio.ended) {
                    // ?�생 ?�간?� ?�에 ?�으�??�시 ?�생 (루프)
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
            console.warn("[Shopping] BGM 로드 ?�패, 계속 진행:", e)
            bgmAudio = null // BGM 로드 ?�패 ??null�??�정
            setPreviewBgmAudio(null)
            resolve() // BGM???�어??계속 진행
          }
        })
      } else {
        // BGM???�으�?기존 BGM ?�리
        if (previewBgmAudio) {
          previewBgmAudio.pause()
          previewBgmAudio.currentTime = 0
          previewBgmAudio.src = "" // ?�디???�스 ?�거
          previewBgmAudio.load() // ?�디??리소???�제
          setPreviewBgmAudio(null)
        }
      }

      // ?�과??로드 (?�는 경우)
      if (sfxUrl) {
        console.log("[Shopping] ?�과??로드")
        sfxAudio = new Audio(sfxUrl)
        sfxAudio.volume = sfxVolume
        sfxAudio.loop = false
        
        await new Promise<void>((resolve, reject) => {
          if (!sfxAudio) {
            reject(new Error("?�과???�성 ?�패"))
            return
          }
          sfxAudio.onloadeddata = () => {
            setPreviewSfxAudio(sfxAudio)
            resolve()
          }
          sfxAudio.onerror = (e) => {
            console.warn("[Shopping] ?�과??로드 ?�패, 계속 진행:", e)
            sfxAudio = null
            setPreviewSfxAudio(null)
            resolve()
          }
        })
      } else {
        // ?�과?�이 ?�으�?기존 ?�과???�리
        if (previewSfxAudio) {
          previewSfxAudio.pause()
          previewSfxAudio.currentTime = 0
          setPreviewSfxAudio(null)
        }
      }

      const actualAudioDuration = audio.duration
      console.log("[Shopping] ?�제 ?�디??길이:", actualAudioDuration.toFixed(3), "�?)

      // 비디???�리먼트가 ?�거??개수가 맞�? ?�으�??�로 로드
      if (!videoElements || videoElements.length !== videoUrlsArray.length) {
        console.log("[Shopping] 비디???�로 로드")
        videoElements = []
        for (let i = 0; i < videoUrlsArray.length; i++) {
          const videoUrl = videoUrlsArray[i]
          const video = document.createElement("video")
          video.crossOrigin = "anonymous"
          video.src = videoUrl
          video.muted = true
          video.playsInline = true
          // 모바?�에?????��? 버퍼링을 ?�해 preload ?�정
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                          (typeof window !== "undefined" && window.innerWidth <= 768)
          // 모바?�에?�도 auto�??�정?�여 충분??버퍼�?보장
          video.preload = "auto"
          
          await new Promise<void>((resolve, reject) => {
            // loadedmetadata?� canplay ?�벤???�용
            let metadataLoaded = false
            let canPlay = false
            let canPlayThrough = false
            
            const checkReady = () => {
              // 모바?�에?�는 canplaythrough까�? 기다�?              if (isMobile) {
                if (metadataLoaded && canPlay && canPlayThrough) {
                  video.currentTime = 0 // ?�작 ?�치�?초기??                  console.log(`[Shopping] 비디??${i + 1} 로드 ?�료 (모바??: duration=${video.duration.toFixed(2)}�? readyState=${video.readyState}`)
                  resolve()
                }
              } else {
              if (metadataLoaded && canPlay) {
                video.currentTime = 0 // ?�작 ?�치�?초기??                console.log(`[Shopping] 비디??${i + 1} 로드 ?�료: duration=${video.duration.toFixed(2)}�?)
                resolve()
                }
              }
            }
            
            video.onloadedmetadata = () => {
              metadataLoaded = true
              console.log(`[Shopping] 비디??${i + 1} 메�??�이??로드 ?�료`)
              checkReady()
            }
            
            video.oncanplay = () => {
              canPlay = true
              console.log(`[Shopping] 비디??${i + 1} canplay ?�벤??)
              checkReady()
            }
            
            // 모바?�에??버퍼�?개선???�한 ?�벤??추�?
            if (isMobile) {
              video.oncanplaythrough = () => {
                canPlayThrough = true
                console.log(`[Shopping] 비디??${i + 1} canplaythrough ?�벤??(모바??`)
                checkReady()
              }
            }
            
            video.onerror = (e) => {
              console.error(`[Shopping] 비디??${i + 1} 로드 ?�러:`, e)
              reject(new Error(`비디??${i + 1} 로드 ?�패`))
            }
            
            video.load()
            
            // ?�?�아???�정 (모바?�에?�는 ??길게)
            const timeout = isMobile ? 30000 : 15000
            setTimeout(() => {
              if (isMobile && (!metadataLoaded || !canPlay || !canPlayThrough)) {
                console.warn(`[Shopping] 비디??${i + 1} 로드 ?�?�아??(모바??, 계속 진행 (readyState: ${video.readyState})`)
                if (video.readyState >= 2) {
                  // canplay ?�상?�면 계속 진행
                  metadataLoaded = true
                  canPlay = true
                  canPlayThrough = true
                  checkReady()
                } else {
                  resolve() // ?�?�아?�이?�도 계속 진행
                }
              } else if (!isMobile && (!metadataLoaded || !canPlay)) {
                console.warn(`[Shopping] 비디??${i + 1} 로드 ?�?�아?? 계속 진행 (readyState: ${video.readyState})`)
                if (video.readyState >= 1) {
                  // 메�??�이?�라???�으�?계속 진행
                  metadataLoaded = true
                  canPlay = true
                  checkReady()
                } else {
                  resolve() // ?�?�아?�이?�도 계속 진행
                }
              }
            }, timeout)
          })
          videoElements.push(video)
        }
        setPreviewVideoElements(videoElements)
      } else {
        console.log("[Shopping] 기존 비디???�사??)
        // 기존 비디???�사?????�간 초기??        for (const video of videoElements) {
          video.currentTime = 0
          video.pause()
        }
      }

      // �??�상???�제 duration 가?�오�?      const videoDurations: number[] = []
      for (const video of videoElements) {
        if (video.duration && !isNaN(video.duration) && video.duration > 0) {
          videoDurations.push(video.duration)
        } else {
          // duration???�으�?기본�??�용 (?�중???�데?�트)
          videoDurations.push(5) // 기본 5�?        }
      }

      console.log("[Shopping] �??�상???�제 길이:", videoDurations.map(d => d.toFixed(2) + "�?))

      // �??�상???�작 ?�간 계산 (간단?�게 ?�차?�으�??�어붙이�?
      let accumulatedTime = 0
      const videoStartTimes: number[] = []
      for (let i = 0; i < videoDurations.length; i++) {
        videoStartTimes.push(accumulatedTime)
        accumulatedTime += videoDurations[i]
      }

      console.log("[Shopping] �??�상???�작 ?�간:", videoStartTimes.map(t => t.toFixed(2) + "�?))

      // ?�네???��?지 로드 (?�택???�네???�용)
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
            // ?�?�아???�정
            setTimeout(() => {
              if (!thumbnailImage!.complete) {
                reject(new Error("?�네??로드 ?�?�아??))
              }
            }, 5000)
          })
          console.log("[Shopping] ?�택???�네???��?지 로드 ?�료 (?�덱??", selectedThumbnailIndex, ")")
        } catch (error) {
          console.warn("[Shopping] ?�네???��?지 로드 ?�패, 계속 진행:", error)
        }
      } else if (thumbnailUrl) {
        // ?�택???�네?�이 ?�으�?기존 thumbnailUrl ?�용 (?�위 ?�환??
        try {
          thumbnailImage = new Image()
          thumbnailImage.crossOrigin = "anonymous"
          thumbnailImage.src = thumbnailUrl
          await new Promise<void>((resolve, reject) => {
            thumbnailImage!.onload = () => resolve()
            thumbnailImage!.onerror = reject
            setTimeout(() => {
              if (!thumbnailImage!.complete) {
                reject(new Error("?�네??로드 ?�?�아??))
              }
            }, 5000)
          })
          console.log("[Shopping] ?�네???��?지 로드 ?�료 (기존 URL)")
        } catch (error) {
          console.warn("[Shopping] ?�네???��?지 로드 ?�패, 계속 진행:", error)
        }
      }

      // 미리보기 ?�더�??�수 (?�네???�함, BGM �??�과???�용)
      let lastVideoIndex = -1
      const currentBgmAudio = bgmAudio // ?�로?�?�서 ?�근 가?�하?�록
      const currentSfxAudio = sfxAudio // ?�로?�?�서 ?�근 가?�하?�록
      const THUMBNAIL_DURATION = 0.0001
      
      const renderPreview = () => {
        const elapsed = audio.paused ? currentTime : audio.currentTime
        if (!audio.paused) {
          setCurrentTime(elapsed)
          
          // BGM ?�간?� 체크 �??�생/?��?
          if (currentBgmAudio && bgmUrl) {
            // bgmEndTime???�달?�거???�어갔거??bgmStartTime ?�전?�면 무조�??��? (?�격??체크)
            // bgmEndTime???�달?�면 즉시 ?��? (?? 10초에 ?�달?�면 ?��?)
            if (previewAudio && (elapsed >= bgmEndTime || elapsed < bgmStartTime || elapsed >= previewAudio.duration || previewAudio.ended)) {
              if (!currentBgmAudio.paused) {
                currentBgmAudio.pause()
                currentBgmAudio.currentTime = 0
              }
            } else if (previewAudio && elapsed >= bgmStartTime && elapsed < bgmEndTime && elapsed < previewAudio.duration && !previewAudio.ended) {
              // BGM ?�생 ?�간?� ?�에 ?�을 ?�만 ?�생 (elapsed < bgmEndTime - 종료 ?�간???�달?�면 ?�생?��? ?�음)
              if (currentBgmAudio.paused) {
                // BGM ?�작 ?�간??맞춰 ?�디???�치 ?�정
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
                // BGM???�생 중이�?종료 ?�간???�달?�는지 계속 ?�인
                if (elapsed >= bgmEndTime || elapsed >= previewAudio.duration || previewAudio.ended) {
                  // 종료 ?�간???�달?�거???�어갔거???�디?��? ?�났?�면 즉시 ?��?
                  currentBgmAudio.pause()
                  currentBgmAudio.currentTime = 0
                }
              }
            } else {
              // BGM ?�생 ?�간?� 밖이�?무조�??��?
              if (!currentBgmAudio.paused) {
                currentBgmAudio.pause()
                currentBgmAudio.currentTime = 0
              }
            }
          }
          
          // ?�과???�간?� 체크 �??�생/?��?
          if (currentSfxAudio && sfxUrl) {
            if (elapsed >= sfxStartTime && elapsed < sfxEndTime) {
              if (currentSfxAudio.paused) {
                // ?�과???�작 ?�간??맞춰 ?�디???�치 ?�정
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

        // 캔버??초기??        ctx.fillStyle = "black"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // ?�네?�이 ?�고 0.0001�??�하?????�네???�시
        const adjustedElapsed = Math.max(0, elapsed - THUMBNAIL_DURATION)
        
        if (thumbnailImage && elapsed < THUMBNAIL_DURATION) {
          ctx.drawImage(thumbnailImage, 0, 0, canvas.width, canvas.height)
        } else {
          // ?�네???�간??지?�면 기존 ?�상 ?�시
          // ?�재 ?�간??맞는 ?�상 찾기 (?�네???�간 ?�외)
        let currentVideoIndex = -1
        for (let i = 0; i < videoStartTimes.length; i++) {
          const startTime = videoStartTimes[i]
          const endTime = i < videoStartTimes.length - 1 ? videoStartTimes[i + 1] : startTime + videoDurations[i]
          
            if (adjustedElapsed >= startTime && adjustedElapsed < endTime) {
            currentVideoIndex = i
            break
          }
        }

        // 비디???�환 ?�에�?처리
        if (currentVideoIndex !== lastVideoIndex) {
          // ?�전 비디???�시?��?
          if (lastVideoIndex >= 0 && videoElements[lastVideoIndex]) {
            videoElements[lastVideoIndex].pause()
            videoElements[lastVideoIndex].currentTime = 0
          }
          
          // ??비디???�생 ?�작
          if (currentVideoIndex >= 0 && videoElements[currentVideoIndex]) {
            const video = videoElements[currentVideoIndex]
            const videoStartTime = videoStartTimes[currentVideoIndex]
              const videoElapsed = adjustedElapsed - videoStartTime
            
            if (video && !isNaN(video.duration) && video.duration > 0) {
              // 모바?�에??비디?��? ?�전??로드?�었?��? ?�인
              const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                              (typeof window !== "undefined" && window.innerWidth <= 768)
              
              // 모바?�에?�는 readyState가 충분???�아???�생 가??              if (isMobile && video.readyState < 2) {
                // 비디?��? ?�직 로드?��? ?�았?�면 로드 ?��?                video.load()
                video.addEventListener("canplay", () => {
                  video.currentTime = Math.max(0, Math.min(videoElapsed, video.duration))
                  video.play().catch((error) => {
                    console.warn(`[Shopping] 모바??비디???�생 ?�패, ?�시??`, error)
                    // ?�시??                    setTimeout(() => {
                      video.play().catch(() => {})
                    }, 100)
                  })
                }, { once: true })
              } else {
              // ?�작 ?�간 ?�정
              video.currentTime = Math.max(0, Math.min(videoElapsed, video.duration))
              // 비디???�생 (?�체?�으�??�생?�도�?
                video.play().catch((error) => {
                  console.warn(`[Shopping] 비디???�생 ?�패:`, error)
                  // 모바?�에???�생 ?�패 ???�시??                  if (isMobile) {
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

          // ?�재 ?�상??캔버?�에 그리�?(비율 ?��?)
          if (currentVideoIndex >= 0 && videoElements[currentVideoIndex]) {
            const currentVideo = videoElements[currentVideoIndex]
            
            try {
              if (currentVideo.readyState >= 2 || (currentVideo.videoWidth > 0 && currentVideo.videoHeight > 0)) {
                const videoWidth = currentVideo.videoWidth
                const videoHeight = currentVideo.videoHeight
                const canvasWidth = canvas.width
                const canvasHeight = canvas.height
                
                // 비디?��? 캔버?�의 비율 계산
                const videoAspect = videoWidth / videoHeight
                const canvasAspect = canvasWidth / canvasHeight
                
                let drawWidth = canvasWidth
                let drawHeight = canvasHeight
                let drawX = 0
                let drawY = 0
                
                // 비율??맞춰 중앙 ?�롭 (cover 방식)
                if (videoAspect > canvasAspect) {
                  // 비디?��? ???�음 - ?�이??맞추�?좌우 ?�롭
                  drawHeight = canvasHeight
                  drawWidth = drawHeight * videoAspect
                  drawX = (canvasWidth - drawWidth) / 2
                } else {
                  // 비디?��? ???�음 - ?�비??맞추�??�하 ?�롭
                  drawWidth = canvasWidth
                  drawHeight = drawWidth / videoAspect
                  drawY = (canvasHeight - drawHeight) / 2
                }
                
                ctx.drawImage(currentVideo, 0, 0, videoWidth, videoHeight, drawX, drawY, drawWidth, drawHeight)
              }
            } catch (e) {
              // 그리�??�패 ??무시
            }
          }
        }

        // ?�막 그리�?(?�네???�간 ?�안?�는 ?�시?��? ?�음)
        if (scriptLines.length > 0 && (!thumbnailImage || elapsed >= THUMBNAIL_DURATION)) {
          const elapsedMs = adjustedElapsed * 1000
          const currentLine = scriptLines.find(
            line => elapsedMs >= line.startTime && elapsedMs < line.endTime
          )
          
          if (currentLine) {
            // ?��? ?�위(?�표·마침??기�?)�??�눠 ??줄씩 ?�서?��??�시
            const phrases = getSubtitlePhrases(currentLine.text)
            const lineDuration = currentLine.endTime - currentLine.startTime
            const timeInLine = elapsedMs - currentLine.startTime
            const phraseIndex = phrases.length <= 1 ? 0 : Math.min(Math.floor((timeInLine / lineDuration) * phrases.length), phrases.length - 1)
            const textToShow = phrases[phraseIndex] || currentLine.text
            const subtitleY = canvas.height * 0.38
            
            // ?�막 ?�스??(배경 ?�음, 검???�두�?
            ctx.font = "bold 100px 'Noto Sans KR', sans-serif"
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            
            // 검?�색 ?�두�?            ctx.strokeStyle = "black"
            ctx.lineWidth = 12
            ctx.lineJoin = "round"
            ctx.strokeText(textToShow, canvas.width / 2, subtitleY)
            
            // ?�색 글??            ctx.fillStyle = "white"
            ctx.fillText(textToShow, canvas.width / 2, subtitleY)
          }
        }

        if (!audio.ended && !audio.paused) {
          const frameId = requestAnimationFrame(renderPreview)
          setPreviewAnimationFrame(frameId)
        } else {
          setIsPlaying(false)
          // 모든 비디???�시?��?
          for (const video of videoElements) {
            video.pause()
          }
          // BGM ?�시?��? �??��?
          if (currentBgmAudio) {
            currentBgmAudio.pause()
            currentBgmAudio.currentTime = 0 // BGM ?�간 초기??          }
          // ?�과???�시?��? �??��?
          if (currentSfxAudio) {
            currentSfxAudio.pause()
            currentSfxAudio.currentTime = 0
          }
        }
      }

      // 미리보기 ?�계�??�동
      setActiveStep("preview")
      
      // 초기 ?�레??그리�?(?�생?��? ?�고 �??�레?�만 ?�시)
      audio.currentTime = 0
      setCurrentTime(0)
      
      // 초기 ?�레???�더�?(?�간 0?�로 ?�정)
      const initialElapsed = 0
      const THUMBNAIL_DURATION_INIT = 0.0001
      
      // 캔버??초기??      ctx.fillStyle = "black"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // ?�네?�이 ?�으�?먼�? ?�시, ?�으�?�?번째 ?�상 ?�시
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
            
            // 비디?��? 캔버?�의 비율 계산
            const videoAspect = videoWidth / videoHeight
            const canvasAspect = canvasWidth / canvasHeight
            
            let drawWidth = canvasWidth
            let drawHeight = canvasHeight
            let drawX = 0
            let drawY = 0
            
            // 비율??맞춰 중앙 ?�롭 (cover 방식)
            if (videoAspect > canvasAspect) {
              // 비디?��? ???�음 - ?�이??맞추�?좌우 ?�롭
              drawHeight = canvasHeight
              drawWidth = drawHeight * videoAspect
              drawX = (canvasWidth - drawWidth) / 2
            } else {
              // 비디?��? ???�음 - ?�비??맞추�??�하 ?�롭
              drawWidth = canvasWidth
              drawHeight = drawWidth / videoAspect
              drawY = (canvasHeight - drawHeight) / 2
            }
            
            ctx.drawImage(video, 0, 0, videoWidth, videoHeight, drawX, drawY, drawWidth, drawHeight)
          }
        } catch (e) {
          console.warn("초기 비디??그리�??�패:", e)
        }
      }
      
      // ?�동 ?�생?��? ?�음 (?�생 버튼???�러???�생??
    } catch (error) {
      console.error("미리보기 ?�패:", error)
      setError(`미리보기???�패?�습?�다: ${error instanceof Error ? error.message : "?????�는 ?�류"}`)
    }
  }

  // 미리보기 ?�성 (롱폼 방식: HTML video ?�리먼트 ?�용)
  // [모바?�에???�기???�유]
  // 1) 메모�? ?�상 3�??�디???�네?�을 ?�꺼번에 로드?�면 메모�?부족으�???�� 죽거???�길 ???�음.
  // 2) iOS: canplaythrough가 ?�생 ?�에???????��?�? 모바?�에?�는 canplay�??�용?�고 ?�?�아?�을 ?�넉????
  // 3) ?�운로드(MediaRecorder): Safari/iOS??video/webm;vp9�?지?�하지 ?�아 ?�화가 ?�패?????�음 ??지??코덱?�로 ?�백 처리.
  const handleGeneratePreview = async () => {
    // 3개의 개별 ?�상??모두 준비되?�야 ??    if (convertedVideoUrls.size !== 3 || !ttsAudioUrl) {
      alert("3개의 ?�상�?TTS가 모두 준비되?�야 ?�니??")
      return
    }

    setIsGeneratingPreview(true)
    setError("")
    
    try {
      console.log("[Shopping] 미리보기 ?�성 ?�작 (롱폼 방식)")

      // ?�디??로드 (blob URL?��? ?�인)
      let audioUrl: string
      if (ttsAudioUrl.startsWith("blob:")) {
        // blob URL?�면 직접 ?�용
        audioUrl = ttsAudioUrl
      } else {
        // ?�반 URL?�면 fetch�?가?�오�?        const audioResponse = await fetch(ttsAudioUrl)
        const audioBlob = await audioResponse.blob()
        audioUrl = URL.createObjectURL(audioBlob)
      }
      
      const audio = new Audio(audioUrl)
      audio.volume = ttsVolume // TTS 볼륨 ?�정

      await new Promise<void>((resolve, reject) => {
        audio.onloadeddata = () => resolve()
        audio.onerror = reject
      })

      const actualAudioDuration = audio.duration
      console.log("[Shopping] ?�제 ?�디??길이:", actualAudioDuration.toFixed(3), "�?)

      // BGM 로드 (?�는 경우)
      let bgmAudio: HTMLAudioElement | null = null
      let sfxAudio: HTMLAudioElement | null = null
      if (bgmUrl) {
        // ?�로??BGM??만들�??�에 ?�전 BGM ?�리
        if (previewBgmAudio) {
          console.log("[Shopping] ?�전 BGM ?�리")
          previewBgmAudio.pause()
          previewBgmAudio.currentTime = 0
          previewBgmAudio.src = "" // ?�디???�스 ?�거
          previewBgmAudio.load() // ?�디??리소???�제
          setPreviewBgmAudio(null)
        }
        
        console.log("[Shopping] BGM 로드")
        bgmAudio = new Audio(bgmUrl)
        bgmAudio.volume = bgmVolume
        bgmAudio.loop = false // ?�간?�??맞게 ?�생?��?�?loop ?�제
        
        await new Promise<void>((resolve, reject) => {
          if (!bgmAudio) {
            reject(new Error("BGM ?�성 ?�패"))
            return
          }
          bgmAudio.onloadeddata = () => {
            setPreviewBgmAudio(bgmAudio)
            resolve()
          }
          bgmAudio.onerror = (e) => {
            console.warn("[Shopping] BGM 로드 ?�패, 계속 진행:", e)
            bgmAudio = null
            setPreviewBgmAudio(null)
            resolve() // BGM???�어??계속 진행
          }
        })
      } else {
        // BGM???�으�?기존 BGM ?�리
        if (previewBgmAudio) {
          previewBgmAudio.pause()
          previewBgmAudio.currentTime = 0
          previewBgmAudio.src = "" // ?�디???�스 ?�거
          previewBgmAudio.load() // ?�디??리소???�제
          setPreviewBgmAudio(null)
        }
      }

      // ?�과??로드 (?�는 경우)
      if (sfxUrl) {
        console.log("[Shopping] ?�과??로드")
        sfxAudio = new Audio(sfxUrl)
        sfxAudio.volume = sfxVolume
        sfxAudio.loop = false
        
        await new Promise<void>((resolve, reject) => {
          if (!sfxAudio) {
            reject(new Error("?�과???�성 ?�패"))
            return
          }
          sfxAudio.onloadeddata = () => {
            setPreviewSfxAudio(sfxAudio)
            resolve()
          }
          sfxAudio.onerror = (e) => {
            console.warn("[Shopping] ?�과??로드 ?�패, 계속 진행:", e)
            sfxAudio = null
            setPreviewSfxAudio(null)
            resolve()
          }
        })
      } else {
        // ?�과?�이 ?�으�?기존 ?�과???�리
        if (previewSfxAudio) {
          previewSfxAudio.pause()
          previewSfxAudio.currentTime = 0
          setPreviewSfxAudio(null)
        }
      }

      // 3개의 개별 ?�상 로드 (롱폼 방식: HTML video ?�리먼트�?직접 ?�용)
      const videoElements: HTMLVideoElement[] = []
      const videoDurations: number[] = []
      
      // TTS 길이�?3?�로 ?�눈 �?계산
      const durationPerVideo = Math.round(actualAudioDuration / 3)
      
      for (let i = 0; i < 3; i++) {
        const videoUrl = convertedVideoUrls.get(i)
        if (!videoUrl) {
          throw new Error(`?�상 ${i + 1}??준비되지 ?�았?�니??`)
        }
        
        const video = document.createElement("video")
        // blob: URL?� same-origin?�라 crossOrigin 불필?? ?��? URL�?anonymous (CORS)
        if (!videoUrl.startsWith("blob:")) {
        video.crossOrigin = "anonymous"
        }
        video.src = videoUrl
        video.muted = true
        video.playsInline = true
        // 모바?�에?????��? 버퍼링을 ?�해 preload ?�정
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                        (typeof window !== "undefined" && window.innerWidth <= 768)
        // 모바?? canplay�?기다�?(iOS??canplaythrough가 ?�생 ?�에 ???�어???��?·?�?�아???�인)
        video.preload = "auto"
        video.loop = false // ?�차 ?�생?��?�?루프 ?�음
        
        await new Promise<void>((resolve, reject) => {
          let metadataLoaded = false
          let canPlay = false
          let resolved = false
          const done = () => { if (!resolved) { resolved = true; resolve() } }
          const fail = (err: Error) => { if (!resolved) { resolved = true; reject(err) } }
          
          const checkReady = () => {
            // 모바?? canplay�?만족?�면 진행 (canplaythrough ?��???iOS?�서 ?�?�아?�만 ?�고 ?��?)
            if (isMobile) {
              if (metadataLoaded && canPlay) {
                const duration = video.duration || durationPerVideo
                videoDurations.push(duration)
                console.log(`[Shopping] 미리보기 ?�상 ${i + 1} 로드 ?�료 (모바??, 길이: ${duration.toFixed(2)}�? readyState=${video.readyState}`)
                done()
              }
            } else {
              if (metadataLoaded && canPlay) {
            const duration = video.duration || durationPerVideo
            videoDurations.push(duration)
            console.log(`[Shopping] 미리보기 ?�상 ${i + 1} 로드 ?�료, 길이: ${duration.toFixed(2)}�?)
                done()
              }
            }
          }
          
          video.onloadedmetadata = () => {
            metadataLoaded = true
            console.log(`[Shopping] 미리보기 ?�상 ${i + 1} 메�??�이??로드 ?�료`)
            checkReady()
          }
          
          video.oncanplay = () => {
            canPlay = true
            console.log(`[Shopping] 미리보기 ?�상 ${i + 1} canplay ?�벤??)
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
            const msg = video.error?.message ?? "?????�음"
            console.error(`[Shopping] 미리보기 ?�상 ${i + 1} 로드 ?�패: code=${code}, message=${msg}`)
            fail(new Error(`?�상 ${i + 1} 로드 ?�패 (code: ${code}). 브라?��?가 ?�당 ?�식??지?�하지 ?�거???�일???�상?�었?????�습?�다.`))
          }
          video.load()
          
          const timeout = isMobile ? 45000 : 10000
          setTimeout(() => {
            if (resolved) return
            if (metadataLoaded && canPlay) return
            if (isMobile) {
              console.warn(`미리보기 비디??${i + 1} 로드 ?�?�아??(모바??, 계속 진행 (readyState: ${video.readyState})`)
              if (video.readyState >= 2) {
                canPlay = true
                checkReady()
              } else {
              videoDurations.push(durationPerVideo)
                done()
              }
            } else {
              console.warn(`미리보기 비디??${i + 1} 로드 ?�?�아?? 계속 진행`)
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
      
      console.log("[Shopping] 미리보기 3�??�상 로드 ?�료, �??�상 길이:", videoDurations.map(d => d.toFixed(2) + "�?))
      
      // ?�네???��?지 로드 (?�택???�네???�용) - 미리 로드?�여 ?�태�??�??      let thumbnailImage: HTMLImageElement | null = null
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
          console.log("[Shopping] ?�택???�네???��?지 로드 ?�료 (?�덱??", selectedThumbnailIndex, ")")
          setPreviewThumbnailImage(thumbnailImage)
        } catch (error) {
          console.warn("[Shopping] ?�네???��?지 로드 ?�패, 계속 진행:", error)
          setPreviewThumbnailImage(null)
        }
      } else if (thumbnailUrl) {
        // ?�택???�네?�이 ?�으�?기존 thumbnailUrl ?�용 (?�위 ?�환??
        try {
          thumbnailImage = new Image()
          thumbnailImage.crossOrigin = "anonymous"
          await new Promise<void>((resolve, reject) => {
            thumbnailImage!.onload = () => resolve()
            thumbnailImage!.onerror = reject
            thumbnailImage!.src = thumbnailUrl
          })
          console.log("[Shopping] ?�네???��?지 로드 ?�료 (기존 URL)")
          setPreviewThumbnailImage(thumbnailImage)
        } catch (error) {
          console.warn("[Shopping] ?�네???��?지 로드 ?�패, 계속 진행:", error)
          setPreviewThumbnailImage(null)
        }
      } else {
        setPreviewThumbnailImage(null)
      }

      // ?�디??종료 ??BGM??멈추�?      audio.addEventListener("ended", () => {
        console.log("[Shopping] ?�디???�생 ?�료, BGM??멈춤")
        setIsPlaying(false)
        // 비디???�시?��?
        if (previewVideoRef.current) {
          previewVideoRef.current.pause()
        }
        // BGM 강제 ?��? (previewBgmAudio�??�용)
        if (previewBgmAudio) {
          previewBgmAudio.pause()
          previewBgmAudio.currentTime = 0
          // ?�디???�스 ?�거?�여 ?�전???��?
          try {
            previewBgmAudio.src = ""
            previewBgmAudio.load()
          } catch (e) {
            console.warn("[Shopping] BGM ?�리 �??�류:", e)
          }
        }
        // ?�과??강제 ?��?
        if (previewSfxAudio) {
          previewSfxAudio.pause()
          previewSfxAudio.currentTime = 0
          try {
            previewSfxAudio.src = ""
            previewSfxAudio.load()
          } catch (e) {
            console.warn("[Shopping] ?�과???�리 �??�류:", e)
          }
        }
      })

      // 롱폼 방식: onTimeUpdate ?�벤?�로 ?�막 ?�기??      audio.addEventListener("timeupdate", () => {
        const elapsed = audio.currentTime
        setCurrentTime(elapsed)

        // ?�디?��? ?�났?�면 BGM�??�과??모두 ?��?
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

        // BGM ?�간?� 체크 �??�생/?��? (previewBgmAudio�??�용)
        if (previewBgmAudio && bgmUrl) {
          // duration???�효?��? ?�인 (NaN, Infinity 체크)
          const bgmDuration = previewBgmAudio.duration
          if (isFinite(bgmDuration) && bgmDuration > 0) {
            // 먼�? 종료 ?�간???�달?�거???�어갔는지 체크 (가???�선?�위) - ?�격??체크
            // bgmEndTime???�달?�면 즉시 ?��? (?? 10초에 ?�달?�면 ?��?)
            // ??체크�?먼�? ?�행?�여 BGM???�생 중이???�니??무조�??��?
            // CRITICAL: ??체크??�?timeupdate마다 반드???�행?�어????            if (elapsed >= bgmEndTime || elapsed < bgmStartTime || elapsed >= audio.duration || audio.ended) {
              // BGM???�생 중이�?즉시 ?��? (강제 ?��?) - 무조�??��?
              if (!previewBgmAudio.paused) {
                console.log(`[Shopping] ??BGM 강제 ?��?: elapsed=${elapsed.toFixed(2)}�? bgmEndTime=${bgmEndTime}�? bgmStartTime=${bgmStartTime}�?)
                previewBgmAudio.pause()
                previewBgmAudio.currentTime = 0
              }
              // ?�생 ?�간?� 밖이므�????�상 진행?��? ?�음 (return?�로 빠져?�감)
              return // ???�점?�서 ???�상 BGM 로직???�행?��? ?�음
            }
            
            // BGM ?�생 ?�간?� ?�에 ?�을 ?�만 ?�생
            if (elapsed >= bgmStartTime && elapsed < bgmEndTime && elapsed < audio.duration && !audio.ended) {
              // BGM ?�생 ?�간?� ?�에 ?�고 ?�디?��? ?�직 ?�나지 ?�았???�만 ?�생
              // 주의: elapsed < bgmEndTime (?�호 ?�음) - 종료 ?�간???�달?�면 ?�생?��? ?�음
              const bgmOffset = elapsed - bgmStartTime
              const safeCurrentTime = Math.max(0, Math.min(bgmOffset % bgmDuration, bgmDuration))
              
              if (previewBgmAudio.paused) {
                // BGM???�시?��? ?�태�??�생 ?�작
                if (isFinite(safeCurrentTime)) {
                  previewBgmAudio.currentTime = safeCurrentTime
                  previewBgmAudio.play().catch(() => {})
                }
              } else {
                // BGM???�생 중이�?종료 ?�간???�어가지 ?�았?��? 매번 ?�인 (매우 중요!)
                // �?timeupdate마다 체크?�여 종료 ?�간???�달?�면 즉시 ?��?
                // 가??먼�? 종료 ?�간 체크 (?�선?�위 최상?? - ?�생 중일 ?�도 반드??체크
                if (elapsed >= bgmEndTime || elapsed >= audio.duration || audio.ended) {
                  // 종료 ?�간???�달?�거???�어갔거???�디?��? ?�났?�면 즉시 ?��?
                  console.log(`[Shopping] BGM ?�생 �?종료 ?�간 ?�달: elapsed=${elapsed.toFixed(2)}�? bgmEndTime=${bgmEndTime}�? paused=${previewBgmAudio.paused}`)
                  previewBgmAudio.pause()
                  previewBgmAudio.currentTime = 0
                  // ?��? ?????�상 진행?��? ?�음 (return?�로 빠져?�감)
                  return
                }
                
                // 종료 ?�간 ?�에 ?�을 ?�만 ?�간 ?�기??                if (elapsed < bgmEndTime) {
                  // 종료 ?�간 ?�에 ?�으�??�간 ?�기??(0.1�??�상 차이?�면)
                  if (Math.abs(previewBgmAudio.currentTime - safeCurrentTime) > 0.1) {
                    previewBgmAudio.currentTime = safeCurrentTime
                  }
                }
              }
            } else {
              // BGM ?�생 ?�간?� 밖이�?무조�??��?
              if (!previewBgmAudio.paused) {
                console.log(`[Shopping] BGM ?�생 ?�간?� �? elapsed=${elapsed.toFixed(2)}�? bgmStartTime=${bgmStartTime}�? bgmEndTime=${bgmEndTime}�?)
                previewBgmAudio.pause()
                previewBgmAudio.currentTime = 0
              }
            }
          }
        }

        // ?�과???�간?� 체크 �??�생/?��? (previewSfxAudio�??�용)
        if (previewSfxAudio && sfxUrl) {
          // duration???�효?��? ?�인 (NaN, Infinity 체크)
          const sfxDuration = previewSfxAudio.duration
          if (isFinite(sfxDuration) && sfxDuration > 0) {
            // sfxEndTime???�어갔거??sfxStartTime ?�전?�거???�디?��? ?�났?�면 무조�??�과???��?
            if (elapsed >= sfxEndTime || elapsed < sfxStartTime || elapsed >= audio.duration) {
              if (!previewSfxAudio.paused) {
                previewSfxAudio.pause()
                previewSfxAudio.currentTime = 0
              }
            } else if (elapsed >= sfxStartTime && elapsed < sfxEndTime && elapsed < audio.duration) {
              // ?�과???�생 ?�간?� ?�에 ?�고 ?�디?��? ?�직 ?�나지 ?�았???�만 ?�생
              const sfxOffset = elapsed - sfxStartTime
              const safeCurrentTime = Math.max(0, Math.min(sfxOffset, sfxDuration))
              
              if (previewSfxAudio.paused) {
                // ?�과?�이 ?�시?��? ?�태�??�생 ?�작
                if (isFinite(safeCurrentTime)) {
                  previewSfxAudio.currentTime = safeCurrentTime
                  previewSfxAudio.play().catch(() => {})
                }
              } else {
                // ?�과?�이 ?�생 중이�??�간 ?�기??(0.1�??�상 차이?�면)
                if (Math.abs(previewSfxAudio.currentTime - safeCurrentTime) > 0.1) {
                  previewSfxAudio.currentTime = safeCurrentTime
                }
              }
            }
          }
        }

        // ?�디?��? ?�났?��? ?�인
        if (audio.ended || elapsed >= audio.duration) {
          setIsPlaying(false)
          // 비디???�시?��?
          if (previewVideoRef.current) {
            previewVideoRef.current.pause()
          }
          // BGM ?�시?��? �??��? (previewBgmAudio�??�용)
          if (previewBgmAudio) {
            previewBgmAudio.pause()
            const bgmDuration = previewBgmAudio.duration
            if (isFinite(bgmDuration)) {
              previewBgmAudio.currentTime = 0
            }
          }
          // ?�과???�시?��? �??��? (previewSfxAudio�??�용)
          if (previewSfxAudio) {
            previewSfxAudio.pause()
            const sfxDuration = previewSfxAudio.duration
            if (isFinite(sfxDuration)) {
              previewSfxAudio.currentTime = 0
            }
          }
          return
        }

        // ?�네???�간 체크
        const THUMBNAIL_DURATION = 0.01 // 0.01�?        const elapsedMs = elapsed * 1000
        
        // �??�상???�작 ?�간 계산
        const videoStartTimes = [THUMBNAIL_DURATION]
        for (let i = 0; i < 3; i++) {
          const startTime = i === 0 
            ? THUMBNAIL_DURATION 
            : videoStartTimes[i] + videoDurations[i - 1]
          videoStartTimes.push(startTime)
        }
        
        // ?�재 ?�간??맞는 ?�상 찾기 �??�기??        let foundVideoIndex = -1
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
        
        // ?�재 ?�상 ?�덱???�데?�트
        if (foundVideoIndex !== currentVideoIndex) {
          setCurrentVideoIndex(foundVideoIndex)
        }
        
        // ?�재 ?�상 ?�기??        if (foundVideoIndex >= 0 && videoElements[foundVideoIndex]) {
          const video = videoElements[foundVideoIndex]
          
          // video ref???�재 ?�상 ?�정
          if (previewVideoRef.current) {
            // ?�상 ?�환 감�?
            if (previewVideoRef.current.src !== video.src) {
              // ?�상 변�?(?�환 ?�과 최소??
              const wasPlaying = !previewVideoRef.current.paused
              
              previewVideoRef.current.src = video.src
              previewVideoRef.current.crossOrigin = video.crossOrigin
              previewVideoRef.current.muted = video.muted
              previewVideoRef.current.playsInline = video.playsInline
              previewVideoRef.current.loop = false
              
              // ?�상??준비되�?즉시 ?�생
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
              
              // 빠른 ?�이???�과 (거의 즉시)
              setVideoTransitionOpacity(0.3)
              setTimeout(() => setVideoTransitionOpacity(1), 30)
            } else {
              // 같�? ?�상?�면 ?�간 ?�기?�만 ?�행 (???�확?�게)
              if (Math.abs(previewVideoRef.current.currentTime - videoTime) > 0.05) {
                previewVideoRef.current.currentTime = videoTime
              }
              
              // ?�생 보장
              if (previewVideoRef.current.paused && !audio.paused) {
                previewVideoRef.current.play().catch(() => {})
              }
              
              // ?�환 ?�과 ?�료 ?�인
              if (videoTransitionOpacity < 1) {
                setVideoTransitionOpacity(1)
              }
            }
          }
          
          // 백그?�운??비디???�리먼트???�기??          if (!isNaN(video.duration) && video.duration > 0) {
            if (Math.abs(video.currentTime - videoTime) > 0.1) {
              video.currentTime = videoTime
            }
            if (video.paused && !audio.paused) {
              video.play().catch(() => {})
            }
          }
        } else {
          // ?�네???�간?�거???�상 범위�?벗어??경우
          if (previewVideoRef.current && !audio.paused) {
            previewVideoRef.current.pause()
          }
          if (foundVideoIndex === -1) {
            setCurrentVideoIndex(-1)
            setPreviousVideoIndex(-1)
          }
        }

        // ?�막 ?�데?�트 (?�네???�간 ?�외)
        if (scriptLines.length > 0 && (!previewThumbnailImage || elapsed >= THUMBNAIL_DURATION)) {
          const currentLine = scriptLines.find(
            line => elapsedMs >= line.startTime && elapsedMs < line.endTime
          )
          
          if (currentLine) {
            // ?��? ?�위�??�눠 ??줄씩 ?�서?��?(?�표·마침??기�?)
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

      // 미리보기???�디??�?비디???�정 (3�??�상)
      setPreviewAudio(audio)
      setPreviewVideoElements(videoElements)
            
      // video ref??�?번째 ?�상 ?�정 (초기�?
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
      console.log("[Shopping] 미리보기 ?�성 ?�료 (롱폼 방식)")
      alert("미리보기가 ?�성?�었?�니?? ?�생 버튼???�러 ?�인?�세??")
    } catch (error) {
      const msg = error instanceof Error ? error.message : "?????�는 ?�류"
      console.error("미리보기 ?�성 ?�패:", error)
      setError(`미리보기 ?�성???�패?�습?�다: ${msg}`)
      alert(`미리보기 ?�성 ?�패\n\n${msg}\n\nSafari?�서??WebM ?�상??지?�되지 ?�을 ???�습?�다. Chrome ???�른 브라?��??�서 ?�도??보세??`)
    } finally {
      setIsGeneratingPreview(false)
    }
  }

  // 미리보기 ?�생/?�시?��? (롱폼 방식: onTimeUpdate ?�용)
  const handlePreviewPlayPause = () => {
    if (!previewAudio) return

    if (isPlaying) {
      previewAudio.pause()
      // 비디?�도 ?�시?��?
      if (previewVideoRef.current) {
        previewVideoRef.current.pause()
      }
      // BGM ?�시?��?
      if (previewBgmAudio) {
        previewBgmAudio.pause()
      }
      // ?�과???�시?��?
      if (previewSfxAudio) {
        previewSfxAudio.pause()
      }
      setIsPlaying(false)
    } else {
      previewAudio.play()
      setIsPlaying(true)
      
      // 비디???�생 ?�작 (롱폼 방식: ?�순?�게)
      if (previewVideoRef.current) {
        previewVideoRef.current.loop = true
        previewVideoRef.current.currentTime = 0
        previewVideoRef.current.play().catch(() => {})
      }
      
      // ?�생 ?�작 ?�점??BGM�??�과??체크 �??�생
      const elapsed = previewAudio.currentTime
      const audioDuration = previewAudio.duration
      
      // BGM 체크 �??�생 (종료 ?�간???�어�?경우 ?�생?��? ?�음)
      if (previewBgmAudio && bgmUrl && !previewAudio.ended && audioDuration > 0) {
        const bgmDuration = previewBgmAudio.duration
        if (isFinite(bgmDuration) && bgmDuration > 0) {
          // 종료 ?�간???�달?�거???�어갔거???�작 ?�간 ?�전?�면 ?�생?��? ?�음 (?�격??체크)
          // bgmEndTime???�달?�면 즉시 ?��? (?? 10초에 ?�달?�면 ?��?)
          if (elapsed >= bgmEndTime || elapsed < bgmStartTime || elapsed >= audioDuration || previewAudio.ended) {
            // BGM???�생 중이�??��?
            if (!previewBgmAudio.paused) {
              previewBgmAudio.pause()
              previewBgmAudio.currentTime = 0
            }
          } else if (elapsed >= bgmStartTime && elapsed < bgmEndTime && elapsed < audioDuration && !previewAudio.ended) {
            // BGM ?�생 ?�간?� ?�에 ?�을 ?�만 ?�생 (elapsed < bgmEndTime - 종료 ?�간???�달?�면 ?�생?��? ?�음)
            const bgmOffset = elapsed - bgmStartTime
            const safeCurrentTime = Math.max(0, Math.min(bgmOffset % bgmDuration, bgmDuration))
            if (isFinite(safeCurrentTime)) {
              previewBgmAudio.currentTime = safeCurrentTime
              previewBgmAudio.play().catch(() => {})
            }
          } else {
            // BGM ?�생 ?�간?� 밖이�?무조�??��?
            if (!previewBgmAudio.paused) {
              previewBgmAudio.pause()
              previewBgmAudio.currentTime = 0
            }
          }
        }
      }
      
      // ?�과??체크 �??�생
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

  // blob??GCS(?�폼 버킷)???�로?????�근 가?�한 URL 반환 (?�버 ?�운로드??. 균일 버킷 ?��? ?�세???�?�으�??�기??signed URL ?�용.
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
      throw new Error(err.error || `Signed URL ?�패: ${res.status}`)
    }
    const { signedUrl, fileName: storedFileName } = await res.json()
    const putRes = await fetch(signedUrl, { method: "PUT", body: blob, headers: { "Content-Type": contentType } })
    if (!putRes.ok) throw new Error("GCS ?�로???�패")
    // 균일 버킷 ?��? ?�세?�에?�는 makePublic() 불�? ???�기??signed URL ?�용 (Cloud Run????URL�?fetch)
    const readRes = await fetch("/api/upload-to-gcs/signed-read-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: storedFileName, scope: "shopping" }),
    })
    if (!readRes.ok) {
      const err = await readRes.json().catch(() => ({}))
      throw new Error(err.error || "?�기 URL ?�성 ?�패")
    }
    const { readUrl } = await readRes.json()
    return readUrl
  }

  // ?�버 ?�운로드: 미리보기 ?�이??TTS, ?�막, ?�상3�? ?�네?? BGM/?�과??�?Cloud Run?�로 보내 ?�더 ???�운로드
  const handleServerDownload = async () => {
    if (!previewGenerated || !previewAudio || convertedVideoUrls.size !== 3 || !ttsAudioUrl) {
      alert("미리보기�?먼�? ?�성?�고, TTS?� ?�상 3개�? 준비되???�어???�니??")
      return
    }
    const durationSec = previewAudio.duration
    if (!isFinite(durationSec) || durationSec <= 0) {
      alert("?�디??길이�??�인?????�습?�다. 미리보기�??�시 ?�성?�주?�요.")
      return
    }
    const thumbSrc = selectedThumbnailIndex >= 0 && thumbnailImages[selectedThumbnailIndex]
      ? thumbnailImages[selectedThumbnailIndex].url
      : thumbnailUrl || ""
    if (!thumbSrc) {
      alert("?�네?�을 ?�택?�거???�성?�주?�요.")
      return
    }
    if (scriptLines.length === 0) {
      alert("?�막 ?�이?��? ?�습?�다. 미리보기�??�시 ?�성?�주?�요.")
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
        if (!res.ok) throw new Error(`?�운로드 ?�패: ${url}`)
        return res.blob()
      }

      // 1) TTS ?�디???�로??      const ttsBlob = await getBlobFromUrl(ttsAudioUrl)
      const audioGcsUrl = await uploadBlobToGcsShopping(ttsBlob, "tts_audio", ttsBlob.type || "audio/mpeg")

      // 2) ?�상 3�??�로??      const videoUrls: string[] = []
      for (let i = 0; i < 3; i++) {
        const url = convertedVideoUrls.get(i)
        if (!url) throw new Error(`?�상 ${i + 1}???�습?�다.`)
        const blob = await getBlobFromUrl(url)
        const gcsUrl = await uploadBlobToGcsShopping(blob, `segment_${i}`, blob.type || "video/webm")
        videoUrls.push(gcsUrl)
      }

      // 3) ?�네???�로??      const thumbBlob = await getBlobFromUrl(thumbSrc)
      const thumbnailImageUrl = await uploadBlobToGcsShopping(thumbBlob, "thumbnail", thumbBlob.type || "image/jpeg")

      // 4) BGM / ?�과??(?�택)
      let bgmGcsUrl: string | null = null
      let sfxGcsUrl: string | null = null
      if (bgmUrl) {
        try {
          const b = await getBlobFromUrl(bgmUrl)
          bgmGcsUrl = await uploadBlobToGcsShopping(b, "bgm", b.type || "audio/mpeg")
        } catch (e) {
          console.warn("[?�버 ?�운로드] BGM ?�로???�패, BGM ?�이 진행:", e)
        }
      }
      if (sfxUrl) {
        try {
          const b = await getBlobFromUrl(sfxUrl)
          sfxGcsUrl = await uploadBlobToGcsShopping(b, "sfx", b.type || "audio/mpeg")
        } catch (e) {
          console.warn("[?�버 ?�운로드] ?�과???�로???�패, ?�과???�이 진행:", e)
        }
      }

      // 미리보기처럼 TTS??맞춰 ??�?phrase)???�간?��??�달 (getSubtitlePhrases�??�눈 ??구간�?start/end 부??
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
        throw new Error(errData.error || `?�더 ?�청 ?�패: ${renderRes.status}`)
      }
      const result = await renderRes.json()
      const videoUrl = result.videoUrl
      const videoBase64 = result.videoBase64

      let blob: Blob
      if (videoUrl) {
        const videoRes = await fetch(videoUrl)
        if (!videoRes.ok) throw new Error("?�더???�상 ?�운로드 ?�패")
        blob = await videoRes.blob()
      } else if (videoBase64) {
        const binary = atob(videoBase64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        blob = new Blob([bytes], { type: "video/mp4" })
      } else {
        throw new Error("?�답??videoUrl ?�는 videoBase64가 ?�습?�다.")
      }

      // ?�용??기기�??�상 ?�??(모바???�앱: 공유·??창·화�?링크, PC: ?�운로드)
      const fileName = `${(factoryAutoRunItem?.productName || productName) || "shopping"}_server_${Date.now()}.mp4`
      const downloadUrl = URL.createObjectURL(blob)
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
      const inAppBrowser = /NAVER|Naver|KAKAOTALK|Daum|FBAN|FBAV/i.test(ua)
      const mobile = typeof navigator !== "undefined" && (inAppBrowser || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || (typeof window !== "undefined" && window.innerWidth <= 768))
      if (mobile) {
        // 모바?�·인?? ?�면??'?�상 ?�?? 링크 ??�� ?�시 (?�이�????�앱?�서???�동 ?�운로드가 막힘)
        setServerDownloadLink({ url: downloadUrl, fileName })
        setTimeout(() => {
          setServerDownloadLink((prev) => {
            if (prev?.url === downloadUrl) URL.revokeObjectURL(downloadUrl)
            return null
          })
        }, 5 * 60 * 1000)
        const file = new File([blob], fileName, { type: "video/mp4" })
        const share = typeof navigator !== "undefined" ? navigator.share?.bind(navigator) : undefined
        const canShareFile = Boolean(share && (navigator.canShare?.({ files: [file] }) ?? true))
        if (canShareFile && share) {
          try {
            await share({ files: [file], title: fileName, text: "?�더링된 ?�상" })
            if (!factoryAutoRunItem) alert("공유 ?�면?�서 '?�?? ?�는 '?�일???�?????�택?�세??")
          } catch (e) {
            if ((e as Error)?.name !== "AbortError") {
              window.open(downloadUrl, "_blank")
              if (!factoryAutoRunItem) alert("?�상????창에???�렸?????�습?�다.\n???�면 ?�래 '?�상 ?�?? 버튼???�러 주세??")
            }
          }
        } else {
          window.open(downloadUrl, "_blank")
        }
        if (!factoryAutoRunItem) {
          if (inAppBrowser) {
            alert("?�버 ?�더링이 ?�료?�었?�니??\n\n?�래 '?�상 ?�?? 버튼???�러 ?�?�해 주세?? ?�?�이 ???�면 Chrome ?�는 Safari?�서 ???�이지�??�어 ?�시 ?�도??주세??")
          } else {
            alert("?�버 ?�더링이 ?�료?�었?�니??\n?�래 '?�상 ?�?? 버튼???�러 주세??")
          }
        }
      } else {
        const a = document.createElement("a")
        a.href = downloadUrl
        a.download = fileName
        a.click()
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000)
        if (!factoryAutoRunItem) alert("?�버 ?�더링이 ?�료?�었?�니?? ?�운로드가 ?�작?�니??")
      }

      // ?�동??모드 모드: ?�버?�서 받�? ?�상?�로 ?�?????�튜�??�동 ?�로??      if (factoryAutoRunItem) {
        await saveShotFormScheduleVideoBlob(factoryAutoRunItem.id, blob)
        let youtubeUploaded = false
        // ?�로?????�목·?�명??비어 ?�으�?미리 ?�성 (?�동 진행 ??state가 비어 ?�을 ???�음)
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
            console.warn("[Factory] ?�튜�?메�??�이???�성 ?�패:", metaErr)
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
          const clientId = typeof window !== "undefined" ? localStorage.getItem("shopping_animal_factory_youtube_client_id") : null
          const clientSecret = typeof window !== "undefined" ? localStorage.getItem("shopping_animal_factory_youtube_client_secret") : null
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
            alert(`?�튜�??�약 ?�로?��? ?�료?�었?�니??\n${uploadData.message || ""}`)
          } else {
            alert(`?�튜�??�로???�패: ${uploadData.error || uploadRes.statusText}`)
          }
          } catch (e) {
            alert(`?�튜�??�동 ?�로??�??�류: ${e instanceof Error ? e.message : "?????�음"}`)
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
          alert("공장 ?�약 ?�료. ?�동??모드 목록?�서 ?�운로드?????�습?�다.")
        }
      }

      // ?�동??모드 모드?�?�면 ?�료 ??목록?�로
      if (factoryAutoRunItem) {
        setFactoryAutoRunItem(null)
        setShowProjectList(true)
        setShowFactoryView(true)
      }
    } catch (err) {
      console.error("[?�버 ?�운로드] ?�패:", err)
      const msg = err instanceof Error ? err.message : String(err)
      setError(`?�버 ?�운로드 ?�패: ${msg}`)
      alert(`?�버 ?�운로드???�패?�습?�다.\n\n${msg}`)
    } finally {
      setIsServerDownloading(false)
    }
  }

  // 최종 ?�상 ?�더�?(미리보기?� ?�일). ?�약 발행 ??onComplete�?blob ?�달 ???�??
  const handleRenderVideo = async (options?: { onComplete?: (blob: Blob) => void }) => {
    // 3개의 개별 ?�상??모두 준비되?�야 ??    if (convertedVideoUrls.size !== 3 || !ttsAudioUrl || !canvasRef.current) {
      alert("3개의 ?�상�?TTS가 모두 준비되?�야 ?�니??")
      return
    }
    
    if (!previewGenerated || !previewAudio) {
      alert("먼�? 미리보기�??�성?�주?�요.")
      return
    }

    setIsRendering(true)
    setError("")
    try {
      console.log("[Shopping] 최종 ?�상 ?�더�??�작 (미리보기?� ?�일??방식)")

      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        throw new Error("Canvas context�??�성?????�습?�다.")
      }

      // Canvas ?�기�?1080x1920?�로 ?�정
      canvas.width = 1080
      canvas.height = 1920

      // 미리보기?�서 ?�용?�는 ?�디???�사??      const audio = previewAudio
      
      // ?�디???�간 초기??      audio.currentTime = 0
      const actualAudioDuration = audio.duration
      console.log("[Shopping] ?�제 ?�디??길이:", actualAudioDuration.toFixed(3), "�?)

      // 3개의 개별 ?�상 ?�리먼트 ?�성 �?로드
      const videoElements: HTMLVideoElement[] = []
      const videoDurations: number[] = []
      
      // TTS 길이�?3?�로 ?�눈 �?계산
      const durationPerVideo = Math.round(actualAudioDuration / 3)
      
      for (let i = 0; i < 3; i++) {
        const videoUrl = convertedVideoUrls.get(i)
        if (!videoUrl) {
          throw new Error(`?�상 ${i + 1}??준비되지 ?�았?�니??`)
        }
        
        const video = document.createElement("video")
        video.src = videoUrl
        video.crossOrigin = "anonymous"
        // 모바?�에?????��? 버퍼링을 ?�해 preload ?�정
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                        (typeof window !== "undefined" && window.innerWidth <= 768)
        video.preload = isMobile ? "metadata" : "auto"
        video.muted = true
        video.playsInline = true
        
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => {
            const duration = video.duration || durationPerVideo
            videoDurations.push(duration)
            console.log(`[Shopping] ?�상 ${i + 1} 로드 ?�료, 길이: ${duration.toFixed(2)}�?)
            resolve()
          }
          // 모바?�에??버퍼�?개선
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
          
          // 모바?�에?�는 ?�?�아?�을 ??길게
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

      console.log("[Shopping] 3�??�상 로드 ?�료, �??�상 길이:", videoDurations.map(d => d.toFixed(2) + "�?))

      // MediaRecorder ?�정 (롱폼 ?�츠 ?�성�?방식)
      // 부?�러???�더링을 ?�해 30fps�??�정
      const stream = canvas.captureStream(30)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const source = audioContext.createMediaElementSource(audio)
      
      // TTS 볼륨 조절
      const ttsGainNode = audioContext.createGain()
      ttsGainNode.gain.value = ttsVolume
      source.connect(ttsGainNode)
      
      // BGM 추�? (?�는 경우) - bgmUrl�??�으�?추�? (?�일 ?�로???�는 ?�이브러�??�택 모두)
      let bgmGainNode: GainNode | null = null
      let bgmSource: MediaElementAudioSourceNode | null = null
      let bgmAudioElement: HTMLAudioElement | null = null
      if (bgmUrl) {
        bgmAudioElement = new Audio(bgmUrl)
        bgmAudioElement.loop = false // ?�간?�??맞게 ?�생?��?�?loop ?�제
        bgmAudioElement.volume = bgmVolume
        bgmAudioElement.preload = "auto"
        bgmAudioElement.crossOrigin = "anonymous"
        
        // BGM ?�디??로드 ?��?        await new Promise<void>((resolve, reject) => {
          if (!bgmAudioElement) {
            resolve()
            return
          }
          bgmAudioElement.onloadeddata = () => {
            console.log("[Shopping] BGM 로드 ?�료")
            resolve()
          }
          bgmAudioElement.onerror = (e) => {
            console.warn("[Shopping] BGM 로드 ?�패, 계속 진행:", e)
            bgmAudioElement = null
            resolve() // BGM???�어??계속 진행
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
      
      // ?�과??추�? (?�는 경우)
      let sfxGainNode: GainNode | null = null
      let sfxSource: MediaElementAudioSourceNode | null = null
      let sfxAudioElement: HTMLAudioElement | null = null
      if (sfxUrl) {
        sfxAudioElement = new Audio(sfxUrl)
        sfxAudioElement.loop = false
        sfxAudioElement.volume = sfxVolume
        sfxAudioElement.preload = "auto"
        sfxAudioElement.crossOrigin = "anonymous"
        
        // ?�과???�디??로드 ?��?        await new Promise<void>((resolve, reject) => {
          if (!sfxAudioElement) {
            resolve()
            return
          }
          sfxAudioElement.onloadeddata = () => {
            console.log("[Shopping] ?�과??로드 ?�료")
            resolve()
          }
          sfxAudioElement.onerror = (e) => {
            console.warn("[Shopping] ?�과??로드 ?�패, 계속 진행:", e)
            sfxAudioElement = null
            resolve() // ?�과?�이 ?�어??계속 진행
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

      // 부?�러???�더링을 ?�한 MediaRecorder ?�정 (Safari/iOS??vp9 미�??????�백?�로 ?��? 방�?)
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
          console.log("[Shopping] ?�상 ?�더�??�료 (?�약 발행 ?�?�용)")
          setIsRendering(false)
          return
        }
        const videoUrlForDownload = URL.createObjectURL(videoBlob)
        // 모바??기기 감�?
        const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                      (window.innerWidth <= 768)
        if (mobile) {
          console.log("[Shopping] ?�상 ?�더�??�료 (모바??")
          setVideoUrl(videoUrlForDownload)
          setIsRendering(false)
          alert("?�상 ?�더링이 ?�료?�었?�니??\n\n?�운로드 버튼???�러 ?�상???�?�하?�요.")
        } else {
        const a = document.createElement("a")
          a.href = videoUrlForDownload
        a.download = `${productName || "shopping"}_video_${Date.now()}.webm`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
          setTimeout(() => URL.revokeObjectURL(videoUrlForDownload), 1000)
        console.log("[Shopping] ?�상 ?�더�?�??�운로드 ?�료")
        setIsRendering(false)
        }
      }

      // ?�네???��?지 로드 (?�는 경우) - 미리보기?�서 ?�용??�??�사??      let thumbnailImage: HTMLImageElement | null = previewThumbnailImage

      // AudioContext가 suspended ?�태�?resume
      if (audioContext.state === "suspended") {
        await audioContext.resume()
        console.log("[Shopping] AudioContext resumed")
      }

      // ?�더�??�작 (롱폼 ?�츠 ?�성�?방식)
      mediaRecorder.start()
      audio.play()
      
      // BGM�??�과?�이 AudioContext�??�해 ?�생?�도�??�인
      console.log("[Shopping] ?�더�??�작 - BGM:", bgmUrl ? "?�음" : "?�음", "?�과??", sfxUrl ? "?�음" : "?�음")

      // 롱폼 ?�츠 ?�성�?방식?�로 ?�더�?(?�네??+ 3�??�상 ?�차 ?�생)
      // 미리보기?� ?�전???�일??로직 ?�용
      const THUMBNAIL_DURATION = 0.0001 // 미리보기?� ?�일?�게 0.0001�?      let scriptLinesToUse = scriptLines

      // �??�상???�작 ?�간 계산 (미리보기?� ?�일??방식)
      let accumulatedTime = 0
      const videoStartTimes: number[] = []
      for (let i = 0; i < videoDurations.length; i++) {
        videoStartTimes.push(accumulatedTime)
        accumulatedTime += videoDurations[i]
      }

      console.log("[Shopping] ?�더�?- �??�상???�작 ?�간:", videoStartTimes.map(t => t.toFixed(2) + "�?))

      let lastVideoIndex = -1 // 미리보기?� ?�일?�게 lastVideoIndex ?�용

      const renderFrame = () => {
        const elapsed = audio.currentTime

        // BGM ?�간?� 체크 �??�생/?��? (?�더�?중에???�기??
        if (bgmAudioElement && bgmUrl) {
          // bgmEndTime???�어갔거??bgmStartTime ?�전?�면 무조�??��?
          if (elapsed >= bgmEndTime || elapsed < bgmStartTime) {
            if (!bgmAudioElement.paused) {
              bgmAudioElement.pause()
              bgmAudioElement.currentTime = 0
            }
          } else if (elapsed >= bgmStartTime && elapsed < bgmEndTime) {
            // BGM ?�생 ?�간?� ?�에 ?�을 ?�만 ?�생
            if (bgmAudioElement.paused) {
              // BGM ?�작 ?�간??맞춰 ?�디???�치 ?�정
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
              // ?�생 중일 ?�도 ?�간 ?�기??(0.1�??�상 차이?�면)
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

        // ?�과???�간?� 체크 �??�생/?��? (?�더�?중에???�기??
        if (sfxAudioElement && sfxUrl) {
          if (elapsed >= sfxStartTime && elapsed < sfxEndTime) {
            // ?�과???�생 ?�간?� ?�에 ?�을 ?�만 ?�생
            if (sfxAudioElement.paused) {
              // ?�과???�작 ?�간??맞춰 ?�디???�치 ?�정
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
            // ?�과???�간?� 밖이�??��?
            if (!sfxAudioElement.paused) {
              sfxAudioElement.pause()
              sfxAudioElement.currentTime = 0
            }
          }
        }

        // 캔버??초기??        ctx.fillStyle = "black"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // ?�네?�이 ?�고 0.0001�??�하?????�네???�시 (미리보기?� ?�일)
        const adjustedElapsed = Math.max(0, elapsed - THUMBNAIL_DURATION) // 미리보기?� ?�일?�게 adjustedElapsed ?�용
        
        if (thumbnailImage && elapsed < THUMBNAIL_DURATION) {
          ctx.drawImage(thumbnailImage, 0, 0, canvas.width, canvas.height)
        } else {
          // ?�네???�간??지?�면 기존 ?�상 ?�시 (미리보기?� ?�일)
          // ?�재 ?�간??맞는 ?�상 찾기 (?�네???�간 ?�외)
          let currentVideoIndex = -1
          for (let i = 0; i < videoStartTimes.length; i++) {
            const startTime = videoStartTimes[i]
            const endTime = i < videoStartTimes.length - 1 ? videoStartTimes[i + 1] : startTime + videoDurations[i]
            
            if (adjustedElapsed >= startTime && adjustedElapsed < endTime) {
              currentVideoIndex = i
              break
            }
          }

          // 비디???�환 ?�에�?처리 (미리보기?� ?�일)
          if (currentVideoIndex !== lastVideoIndex) {
            // ?�전 비디???�시?��?
            if (lastVideoIndex >= 0 && videoElements[lastVideoIndex]) {
              videoElements[lastVideoIndex].pause()
              videoElements[lastVideoIndex].currentTime = 0
            }
            
            // ??비디???�생 ?�작
            if (currentVideoIndex >= 0 && videoElements[currentVideoIndex]) {
              const video = videoElements[currentVideoIndex]
              const videoStartTime = videoStartTimes[currentVideoIndex]
              const videoElapsed = adjustedElapsed - videoStartTime
              
              if (video && !isNaN(video.duration) && video.duration > 0) {
                // ?�작 ?�간 ?�정
                video.currentTime = Math.max(0, Math.min(videoElapsed, video.duration))
                // 비디???�생 (?�체?�으�??�생?�도�?
                video.play().catch(() => {})
              }
            }
            
            lastVideoIndex = currentVideoIndex
          }

          // ?�재 ?�상??캔버?�에 그리�?(?�더�?최적?? �??�레?�마???�기?? 비율 ?��?)
          if (currentVideoIndex >= 0 && videoElements[currentVideoIndex]) {
            const currentVideo = videoElements[currentVideoIndex]
            const videoStartTime = videoStartTimes[currentVideoIndex]
            const videoElapsed = adjustedElapsed - videoStartTime
            
            // ?�더�??�에??�??�레?�마??비디???�간???�디?�에 맞춰 ?�기??(부?�러???�생???�해)
            if (currentVideo && !isNaN(currentVideo.duration) && currentVideo.duration > 0) {
              const targetTime = Math.max(0, Math.min(videoElapsed, currentVideo.duration))
              // ?�간 차이가 0.1�??�상?�면 ?�기??(?�무 ?�주 ?�정?��? ?�도�?
              if (Math.abs(currentVideo.currentTime - targetTime) > 0.1) {
                currentVideo.currentTime = targetTime
              }
              
              // 비디?��? ?�시?��??�어 ?�으�??�생
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
                
                // 비디?��? 캔버?�의 비율 계산
                const videoAspect = videoWidth / videoHeight
                const canvasAspect = canvasWidth / canvasHeight
                
                let drawWidth = canvasWidth
                let drawHeight = canvasHeight
                let drawX = 0
                let drawY = 0
                
                // 비율??맞춰 중앙 ?�롭 (cover 방식)
                if (videoAspect > canvasAspect) {
                  // 비디?��? ???�음 - ?�이??맞추�?좌우 ?�롭
                  drawHeight = canvasHeight
                  drawWidth = drawHeight * videoAspect
                  drawX = (canvasWidth - drawWidth) / 2
                } else {
                  // 비디?��? ???�음 - ?�비??맞추�??�하 ?�롭
                  drawWidth = canvasWidth
                  drawHeight = drawWidth / videoAspect
                  drawY = (canvasHeight - drawHeight) / 2
                }
                
                ctx.drawImage(currentVideo, 0, 0, videoWidth, videoHeight, drawX, drawY, drawWidth, drawHeight)
              }
            } catch (e) {
              // 그리�??�패 ??무시
            }
          }
        }

        // ?�막 그리�?(?�네???�간 ?�안?�는 ?�시?��? ?�음) - 미리보기?� ?�일
        if (scriptLinesToUse.length > 0 && (!thumbnailImage || elapsed >= THUMBNAIL_DURATION)) {
          const elapsedMs = adjustedElapsed * 1000 // adjustedElapsed ?�용
          const currentLine = scriptLinesToUse.find(
            line => elapsedMs >= line.startTime && elapsedMs < line.endTime
          )
          
          if (currentLine) {
            // ?��? ?�위�??�눠 ??줄씩 ?�서?��?(?�표·마침??기�?)
            const phrases = getSubtitlePhrases(currentLine.text)
            const lineDuration = currentLine.endTime - currentLine.startTime
            const timeInLine = elapsedMs - currentLine.startTime
            const phraseIndex = phrases.length <= 1 ? 0 : Math.min(Math.floor((timeInLine / lineDuration) * phrases.length), phrases.length - 1)
            const textToShow = phrases[phraseIndex] || currentLine.text
            // ?�막 ?�치 계산 (subtitleStyle ?�정 반영)
            // 캔버???�기: 1080x1920, 미리보기 ?�기: 533px 기�?
            // 미리보기?�서??fontSize * 0.6???�용?��?�? ?�더링에?�도 ?�일??비율 ?�용
            const previewHeight = 533 // 미리보기 ?�이 (px)
            const scaleFactor = canvas.height / previewHeight // ?��????�터 계산
            let baseY: number
            if (subtitleStyle.position === "top") {
              baseY = canvas.height * 0.15
            } else if (subtitleStyle.position === "center") {
              baseY = canvas.height * 0.5
            } else {
              baseY = canvas.height * 0.85
            }
            // positionOffset??캔버???�기??맞게 ?��??�링
            const offsetY = subtitleStyle.positionOffset * scaleFactor
            const subtitleY = baseY + offsetY
            
            // ?�막 ?��????�용 (미리보기?� ?�일??비율: fontSize * 0.6 * scaleFactor)
            const fontSize = subtitleStyle.fontSize * 0.6 * scaleFactor
            ctx.font = `${subtitleStyle.fontWeight} ${fontSize}px '${subtitleStyle.fontFamily}', sans-serif`
            ctx.textAlign = subtitleStyle.textAlign
            ctx.textBaseline = "middle"
            
            // ?�스???�기 측정 (배경 그리기용)
            const textMetrics = ctx.measureText(textToShow)
            const textWidth = textMetrics.width
            const textHeight = fontSize
            const padding = fontSize * 0.2 // ?�딩 계산
            
            // 배경 그리�?(backgroundColor가 ?�명?��? ?�으�?
            if (subtitleStyle.backgroundColor && subtitleStyle.backgroundColor !== "transparent") {
              const bgColor = subtitleStyle.backgroundColor
              ctx.fillStyle = bgColor
              
              // ?�스???�렬???�라 배경 ?�치 조정
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
              
              // ?�근 모서�?배경 (간단???�각?�으�??��?
              ctx.fillRect(bgX, bgY, bgWidth, bgHeight)
            }
            
            // ?�스??그림??(textShadow가 true??경우)
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
            
            // ?�스???�렬???�라 X ?�치 계산
            let textX: number
            if (subtitleStyle.textAlign === "center") {
              textX = canvas.width / 2
            } else if (subtitleStyle.textAlign === "right") {
              textX = canvas.width - padding
            } else {
              textX = padding
            }
            
            // ?�막 ?�스??그리�?            ctx.fillStyle = subtitleStyle.color
            ctx.fillText(textToShow, textX, subtitleY)
          }
        }

        // ?�음 ?�레???�청 (롱폼 ?�츠 ?�성�?방식)
        if (!audio.paused && elapsed < actualAudioDuration) {
          requestAnimationFrame(renderFrame)
        } else {
          // ?�더�?종료 ??BGM �??�과???�리
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
      console.error("?�상 ?�더�??�패:", error)
      setError(`?�상 ?�더링에 ?�패?�습?�다: ${error instanceof Error ? error.message : "?????�는 ?�류"}`)
      setIsRendering(false)
    }
  }

  // 1�??��?지�?3분할 ?�상?�로 변??(?�품?�상 4�? ?��??�상 4�? ?�른 각도 4�?
  const handleConvertAllImagesToVideos = async () => {
    if (imageUrls.length !== 3) {
      alert("?��?지 3개�? 준비되?�야 ?�니??")
      return
    }

    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined
    const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined

    if (!replicateApiKey) {
      alert("Replicate API ?��? ?�요?�니?? 메인 ?�면???�정(?�니바�??�이�??�서 API ?��? ?�력?�주?�요.")
      return
    }

    // 즉시 로딩 ?�태 ?�시 (모든 ?�상???�??
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
      // TTS 길이 계산 (?�디??메�??�이?��? ?�선 ?�용)
      let totalTtsDuration = 12 // 기본�?12�?      
      // 1?�위: ?�디??메�??�이???�용 (가???�확??
      if (ttsAudioUrl) {
        try {
          const audio = new Audio(ttsAudioUrl)
          await new Promise((resolve, reject) => {
            audio.onloadedmetadata = () => {
              totalTtsDuration = Math.ceil(audio.duration)
              console.log(`[Shopping] ??TTS 길이: ${totalTtsDuration}�?(?�디??메�??�이??기반, ?�제 길이: ${audio.duration.toFixed(2)}�?`)
              resolve(undefined)
            }
            audio.onerror = reject
            audio.load()
          })
        } catch (audioError) {
          console.warn("[Shopping] TTS ?�디??길이 가?�오�??�패, scriptLines ?�용:", audioError)
        }
      }
      
      // 2?�위: scriptLines ?�용 (?�디??메�??�이?��? ?�을 ?�만)
      if (totalTtsDuration === 12 && scriptLines && scriptLines.length > 0) {
        const lastLine = scriptLines[scriptLines.length - 1]
        const scriptLinesDuration = Math.ceil(lastLine.endTime / 1000)
        // scriptLines??endTime??비정?�적?�로 ?�면 무시 (?? 37�?
        if (scriptLinesDuration <= 60) { // 최�? 60초까지�??�용
          totalTtsDuration = scriptLinesDuration
          console.log(`[Shopping] ?�️ TTS 길이: ${totalTtsDuration}�?(scriptLines 기반, ?�디??메�??�이???�음)`)
        } else {
          console.warn(`[Shopping] ?�️ scriptLines??endTime??비정?�적?�니??(${scriptLinesDuration}�?. 기본�??�용.`)
        }
      }
      
      // �??��?지???�상 길이 계산 (TTS 길이�?3?�로 ?�누�?반올�?
      // CRITICAL: �??�상?� 반드??TTS 길이 / 3?�로 고정?�어????      const durationPerVideo = Math.round(totalTtsDuration / 3)
      
      // durationPerVideo가 ?�효?��? ?�인 (0보다 커야 ??
      if (!durationPerVideo || durationPerVideo <= 0) {
        throw new Error(`?�상 길이 계산 ?�류: durationPerVideo=${durationPerVideo}�?(TTS: ${totalTtsDuration}�?`)
      }
      
      console.log(`[Shopping] ?�� TTS 길이 계산 결과:`)
      console.log(`  - TTS ?�체 길이: ${totalTtsDuration}�?)
      console.log(`  - �??��?지??duration: ${totalTtsDuration} / 3 = ${(totalTtsDuration / 3).toFixed(2)}�?)
      console.log(`  - 반올림된 duration: ${durationPerVideo}�?)
      console.log(`  - �??�상 길이 (?�상): ${durationPerVideo * 3}�?)
      console.log(`  - ?�️ CRITICAL: �??�상?� 반드??${durationPerVideo}초로 ?�성?�어???�니?? TTS ?�체 길이(${totalTtsDuration}�?가 ?�닙?�다!`)
      
      // �??�상??sample_shift 계산 (�??�상 길이??맞게)
      const sampleShiftPerVideo = Math.max(8, Math.min(16, durationPerVideo))
      
      console.log(`[Shopping] 3�??��?지�??�상?�로 변???�작 (TTS: ${totalTtsDuration}�? �??�상: ${durationPerVideo}�? sample_shift: ${sampleShiftPerVideo})`)
      
      const videoResults: Array<{ index: number; videoUrl: string; duration: number; sceneType: string }> = []
      const newVideoMap = new Map<number, string>()
      const sceneNames = ["?�품 ?�용 ?�상", "?�테???�상", "?�른 배경 ?�상"]
      
      // 기존???�성???�상???�으�??��?
      const existingVideos = new Map(convertedVideoUrls)
      
      // 1?�계: 모든 ?��?지???�???�롬?�트�?먼�? ?�성 (OpenAI API ?�용)
      console.log(`[Shopping] ?�� 1?�계: ?�상 ?�롬?�트 ?�성 ?�작 (OpenAI API ?�용)`)
      const videoPromptsMap = new Map<number, string>()
      
      for (let i = 0; i < 3; i++) {
        // ?��? ?�성???�상???�으�??�롬?�트??건너?�기 (기존 ?�롬?�트가 ?�으�??�용)
        if (existingVideos.has(i) && videoPrompts.has(i)) {
          console.log(`[Shopping] ??�� ${sceneNames[i]} ?�롬?�트 ?��? 존재, 건너?�`)
          videoPromptsMap.set(i, videoPrompts.get(i)!)
          continue
        }
        
        // ?�롬?�트 ?�성 �??�태 ?�데?�트
        setIsGeneratingVideoPrompts((prev) => {
          const newMap = new Map(prev)
          newMap.set(i, true)
          return newMap
        })
        
        try {
          console.log(`[Shopping] ?�� ${sceneNames[i]} ?�롬?�트 ?�성 �?.. (${i + 1}/3)`)
          
          // OpenAI API�??�용?�여 ?�품 ?�동 ?�롬?�트 ?�성
          const videoPrompt = await generateVideoPromptForImage(
            i as 0 | 1 | 2,
            productName,
            productDescription,
            durationPerVideo,
            openaiApiKey,
            animalCharacter
          )
          
          console.log(`[Shopping] ??${sceneNames[i]} ?�롬?�트 ?�성 ?�료`)
          console.log(`[Shopping] ?�� ?�롬?�트 ?�용 (${sceneNames[i]}):`, videoPrompt.substring(0, 200) + "...")
          
          // ?�롬?�트 ?�??          videoPromptsMap.set(i, videoPrompt)
          setVideoPrompts((prev) => {
            const newMap = new Map(prev)
            newMap.set(i, videoPrompt)
            return newMap
          })
        } catch (error) {
          console.error(`[Shopping] ??${sceneNames[i]} ?�롬?�트 ?�성 ?�패:`, error)
          setError(`${sceneNames[i]} ?�롬?�트 ?�성???�패?�습?�다: ${error instanceof Error ? error.message : "?????�는 ?�류"}`)
          throw error
        } finally {
          setIsGeneratingVideoPrompts((prev) => {
            const newMap = new Map(prev)
            newMap.set(i, false)
            return newMap
          })
        }
      }
      
      console.log(`[Shopping] ??모든 ?�롬?�트 ?�성 ?�료! ?�제 ?�상???�성?�니??`)
      
      // 2?�계: ?�성???�롬?�트�??�용?�여 ?�상 ?�성
      console.log(`[Shopping] ?�� 2?�계: ?�상 ?�성 ?�작`)
      
      for (let i = 0; i < 3; i++) {
        // ?��? ?�성???�상???�으�?건너?�기
        if (existingVideos.has(i)) {
          console.log(`[Shopping] ??�� ${sceneNames[i]} ?��? ?�성?? 건너?�`)
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
          console.error(`[Shopping] ??${sceneNames[i]} ?�롬?�트가 ?�습?�다.`)
          throw new Error(`${sceneNames[i]} ?�롬?�트가 ?�성?��? ?�았?�니??`)
        }
        
        // 변???�작 ?�태 ?�데?�트
        setIsConvertingToVideo((prev) => {
          const newMap = new Map(prev)
          newMap.set(i, true)
          console.log(`[Shopping] ?�� ${sceneNames[i]} 변???�태 ?�데?�트: true (?�덱??${i})`)
          return newMap
        })
        
        console.log(`[Shopping] ?�� ${sceneNames[i]} ?�상 ?�성 ?�작 (${i + 1}/3)`)
        console.log(`[Shopping] ?�️ CRITICAL: �??�상 길이 = ${durationPerVideo}�?(TTS ?�체: ${totalTtsDuration}�?/ 3 = ${(totalTtsDuration / 3).toFixed(2)}�?`)
        console.log(`[Shopping] ?�️ CRITICAL: ???�상?� 반드??${durationPerVideo}초로 ?�성?�어???�니?? TTS ?�체 길이(${totalTtsDuration}�?가 ?�닙?�다!`)
        console.log(`[Shopping] ?�� ?�용???�롬?�트:`, videoPrompt.substring(0, 200) + "...")
        
        // ?��?지�??�상?�로 변??(bytedance/seedance-1-pro-fast 모델 ?�용, duration ?�용)
        // CRITICAL: durationPerVideo??반드??TTS/3?�로 계산??값이?�야 ??        if (durationPerVideo !== Math.round(totalTtsDuration / 3)) {
          console.error(`[Shopping] ??CRITICAL ERROR: durationPerVideo가 ?�바르�? ?�습?�다!`)
          console.error(`  - durationPerVideo: ${durationPerVideo}�?)
          console.error(`  - ?�상 �?(TTS/3): ${Math.round(totalTtsDuration / 3)}�?)
          console.error(`  - TTS ?�체: ${totalTtsDuration}�?)
          throw new Error(`?�상 길이 계산 ?�류: durationPerVideo=${durationPerVideo}�? ?�상=${Math.round(totalTtsDuration / 3)}�?)
        }
        
        try {
          const videoUrl = await generateVideoWithSeedance(
            imageUrl,
            videoPrompt,
            durationPerVideo, // duration ?�달 (반드??TTS/3)
            replicateApiKey
          )
          
          console.log(`[Shopping] ??${sceneNames[i]} ?�성 ?�료:`, videoUrl)
          
          // 변?�된 ?�상 URL ?�??�?즉시 ?�시
          newVideoMap.set(i, videoUrl)
          setConvertedVideoUrls(new Map(newVideoMap))
          
          videoResults.push({
            index: i,
            videoUrl,
            duration: durationPerVideo, // 계산??duration ?�용
            sceneType: sceneNames[i]
          })
        } catch (error) {
          console.error(`[Shopping] ??${sceneNames[i]} ?�성 ?�패:`, error)
          throw error
        } finally {
          // ?�태 ?�데?�트??finally?�서 ?�실???�행
          setIsConvertingToVideo((prev) => {
            const newMap = new Map(prev)
            newMap.set(i, false)
            // 모든 ?�상???�료?�었?��? ?�인
            const allComplete = Array.from(newMap.values()).every(v => v === false)
            console.log(`[Shopping] ?�� ${sceneNames[i]} 변???�태 ?�데?�트: false (?�덱??${i}), 모든 ?�상 ?�료: ${allComplete}, ?�재 ?�태:`, Array.from(newMap.entries()))
            return newMap
          })
        }
      }
      
      // ?�상 ?�치�?기능 ?�거 - 개별 ?�상 3개만 ?�용
      const totalVideoDuration = videoResults.reduce((sum, result) => sum + result.duration, 0)
      console.log(`[Shopping] 3�??�상 변???�료 (�??�상: ${durationPerVideo}�? �?${totalVideoDuration.toFixed(1)}�? TTS: ${totalTtsDuration}�?`)
      
      // 모든 ?�상???�?�되?�는지 ?�인?�고 최종 ?�데?�트
      if (newVideoMap.size === 3) {
        console.log(`[Shopping] ??모든 ?�상???�공?�으�??�?�되?�습?�다 (${newVideoMap.size}/3)`)
        // 최종 ?�태 ?�데?�트 (모든 ?�상???�실???�?�되?�록)
        setConvertedVideoUrls(new Map(newVideoMap))
      } else {
        console.warn(`[Shopping] ?�️ ?�상 ?�???�태 ?�인: ${newVideoMap.size}/3`)
      }
      
      // 모든 변???�태 ?�실??초기??(모든 ?�상 ?�료 ??
      // ?�태 ?�데?�트가 ?�료???�간??주고 ?�실??초기??      await new Promise(resolve => setTimeout(resolve, 200)) // ?�태 ?�데?�트가 ?�료???�간??�?      setIsConvertingToVideo((prev) => {
        // 모든 값이 false?��? ?�인?�고 �?Map?�로 초기??        const allFalse = Array.from(prev.values()).every(v => v === false)
        if (allFalse || prev.size === 0) {
          console.log(`[Shopping] ?�� 모든 변???�태 초기???�료 (?�전 ?�태: ${prev.size}�???��)`)
          return new Map()
        }
        // ?�시 모�? 경우�??�해 모든 ??��??false�??�정
        const clearedMap = new Map<number, boolean>()
        console.log(`[Shopping] ?�� 모든 변???�태�?false�??�정 ??초기??)
        return clearedMap
      })
    } catch (error) {
      console.error("[Shopping] ???�상 변???�패:", error)
      setError(`?�상 변?�에 ?�패?�습?�다: ${error instanceof Error ? error.message : "?????�는 ?�류"}`)
      
      // ?�러 발생 ??모든 변???�태 초기??      setIsConvertingToVideo(new Map())
      setIsMergingVideos(false)
      console.log(`[Shopping] ?�� ?�러 발생?�로 ?�한 모든 ?�태 초기???�료`)
    }
  }

  // 개별 ?�상 ?�생??  const handleRegenerateSingleVideo = async (index: 0 | 1 | 2) => {
    if (imageUrls.length <= index) {
      alert("?�당 ?��?지가 ?�습?�다.")
      return
    }

    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined
    const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined

    if (!replicateApiKey) {
      alert("Replicate API ?��? ?�요?�니?? 메인 ?�면???�정(?�니바�??�이�??�서 API ?��? ?�력?�주?�요.")
      return
    }

    // 즉시 로딩 ?�태 ?�시
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
    
    // ?�면 ?�름 ?�의 (try-catch 블록?�서 모두 ?�용 가?�하?�록 ?�수 ?�단???�의)
    const sceneNames = ["?�품 ?�용 ?�상", "?�테???�상", "?�른 배경 ?�상"]
    
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
          console.warn("[Shopping] TTS ?�디??길이 가?�오�??�패:", audioError)
        }
      }
      
      // �??��?지???�상 길이 계산
      // CRITICAL: �??�상?� 반드??TTS 길이 / 3?�로 고정?�어????      const durationPerVideo = Math.round(totalTtsDuration / 3)
      
      // durationPerVideo가 ?�효?��? ?�인 (0보다 커야 ??
      if (!durationPerVideo || durationPerVideo <= 0) {
        throw new Error(`?�상 길이 계산 ?�류: durationPerVideo=${durationPerVideo}�?(TTS: ${totalTtsDuration}�?`)
      }
      
      console.log(`[Shopping] ?�️ CRITICAL: �??�상?� 반드??${durationPerVideo}초로 ?�성?�어???�니?? TTS ?�체 길이(${totalTtsDuration}�?가 ?�닙?�다!`)
      
      // 1?�계: ?�롬?�트 먼�? ?�성 (OpenAI API ?�용)
      console.log(`[Shopping] ?�� 1?�계: ${sceneNames[index]} ?�롬?�트 ?�성 ?�작 (OpenAI API ?�용)`)
      
      let videoPrompt: string
      try {
        console.log(`[Shopping] ?�� ${sceneNames[index]} ?�롬?�트 ?�성 �?..`)
      
        // OpenAI API�??�용?�여 ?�품 ?�동 ?�롬?�트 ?�성
        videoPrompt = await generateVideoPromptForImage(
        index,
        productName,
        productDescription,
        durationPerVideo,
        openaiApiKey,
        animalCharacter
      )
        
        console.log(`[Shopping] ??${sceneNames[index]} ?�롬?�트 ?�성 ?�료`)
        console.log(`[Shopping] ?�� ?�롬?�트 ?�용:`, videoPrompt.substring(0, 200) + "...")
        
        // ?�롬?�트 ?�??        setVideoPrompts((prev) => {
          const newMap = new Map(prev)
          newMap.set(index, videoPrompt)
          return newMap
        })
      } catch (error) {
        console.error(`[Shopping] ??${sceneNames[index]} ?�롬?�트 ?�성 ?�패:`, error)
        setError(`${sceneNames[index]} ?�롬?�트 ?�성???�패?�습?�다: ${error instanceof Error ? error.message : "?????�는 ?�류"}`)
        throw error
      } finally {
        setIsGeneratingVideoPrompts((prev) => {
          const newMap = new Map(prev)
          newMap.set(index, false)
          return newMap
        })
      }
      
      // 2?�계: ?�성???�롬?�트�??�용?�여 ?�상 ?�성
      console.log(`[Shopping] ?�� 2?�계: ${sceneNames[index]} ?�상 ?�성 ?�작`)
      
      // ?�롬?�트 ?�성 ?�료, ?�제 ?�상 ?�성 ?�계
      setIsGeneratingVideoPrompts((prev) => {
        const newMap = new Map(prev)
        newMap.set(index, false)
        return newMap
      })
      
      console.log(`[Shopping] ?�� ${sceneNames[index]} ?�생???�작 (길이: ${durationPerVideo}�?`)
      console.log(`[Shopping] ?�� ?�용???�롬?�트:`, videoPrompt.substring(0, 200) + "...")
      
      // ?��?지�??�상?�로 변??      const imageUrl = imageUrls[index]
      const videoUrl = await generateVideoWithSeedance(
        imageUrl,
        videoPrompt,
        durationPerVideo,
        replicateApiKey
      )
      
      console.log(`[Shopping] ??${sceneNames[index]} ?�생???�료:`, videoUrl)
      
      // 변?�된 ?�상 URL ?�??�?즉시 ?�시
      setConvertedVideoUrls((prev) => {
        const newMap = new Map(prev)
        newMap.set(index, videoUrl)
        return newMap
      })
      
    } catch (error) {
      console.error(`[Shopping] ??${sceneNames[index]} ?�생???�패:`, error)
      setError(`?�상 ?�생?�에 ?�패?�습?�다: ${error instanceof Error ? error.message : "?????�는 ?�류"}`)
    } finally {
      // ?�태 ?�데?�트
      setIsConvertingToVideo((prev) => {
        const newMap = new Map(prev)
        newMap.set(index, false)
        return newMap
      })
    }
  }

  // 개별 ?�면???�상?�로 변??(?�거??- ?�환???��?)
  const handleConvertImageToVideo = async (sceneIndex: number) => {
    if (imageUrls.length === 0) {
      alert("?��?지가 준비되?�야 ?�니??")
      return
    }

    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined

    if (!replicateApiKey) {
      alert("Replicate API ?��? ?�요?�니?? 메인 ?�면???�정(?�니바�??�이�??�서 API ?��? ?�력?�주?�요.")
      return
    }

    // ?�당 ?�면??변???�태�?true�??�정
    setIsConvertingToVideo((prev) => {
      const newMap = new Map(prev)
      newMap.set(sceneIndex, true)
      return newMap
    })
    setError("")
    try {
      console.log(`[Shopping] ?�면 ${sceneIndex + 1} ?�상 변???�작`)

      // ?�본이 ?�으�??�당 ?�면???��??�용, ?�으�?기본 ?�롬?�트
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
      
      // 변?�된 ?�상 URL ?�??      setConvertedVideoUrls((prev) => {
        const newMap = new Map(prev)
        newMap.set(sceneIndex, videoUrl)
        return newMap
      })
      
      console.log(`[Shopping] ?�면 ${sceneIndex + 1} ?�상 변???�료:`, videoUrl)
      alert(`?�면 ${sceneIndex + 1} ?�상 변?�이 ?�료?�었?�니??`)
    } catch (error) {
      console.error(`[Shopping] ?�면 ${sceneIndex + 1} ?�상 변???�패:`, error)
      setError(`?�면 ${sceneIndex + 1} ?�상 변?�에 ?�패?�습?�다: ${error instanceof Error ? error.message : "?????�는 ?�류"}`)
    } finally {
      // ?�당 ?�면??변???�태�?false�??�정
      setIsConvertingToVideo((prev) => {
        const newMap = new Map(prev)
        newMap.set(sceneIndex, false)
        return newMap
      })
    }
  }

  // 모바??기기 감�?
  const isMobile = () => {
    if (typeof window === "undefined") return false
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           (window.innerWidth <= 768)
  }

  // 비디???�운로드 (모바???�??
  // ?�약 발행 모달 ?�기 (기본�? ?�일 09:00)
  const handleOpenScheduleModal = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setScheduleDate(tomorrow.toISOString().slice(0, 10))
    setScheduleTime("09:00")
    setScheduleModalOpen(true)
  }

  // ?�약 발행 ?�정: ?�상 ?�더 ??blob ?�????목록??추�?
  const handleConfirmSchedule = async () => {
    if (!scheduleDate || !scheduleTime) {
      alert("발행 ?�짜?� ?�간???�택?�주?�요.")
      return
    }
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`)
    if (scheduledAt <= new Date()) {
      alert("발행 ?�시???�재보다 미래�??�정?�주?�요.")
      return
    }
    const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const newItem: ShoppingScheduleItem = {
      id: scheduleId,
      productName: productName || "?�품",
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
          alert("?�약 발행???�록?�었?�니?? ?�당 ?�짜???�약 목록?�서 ?�운로드?????�습?�다.")
        },
      })
    } catch (e) {
      setIsScheduling(false)
      setScheduleModalOpen(false)
      alert("?�약 발행 처리 �??�류가 발생?�습?�다.")
    }
  }

  // ?�약 목록?�서 ?�상 ?�운로드 (모바?? 공유/??�?
  const handleDownloadScheduled = async (item: ShoppingScheduleItem) => {
    const blob = await getShotFormScheduleVideoBlob(item.id)
    if (!blob) {
      alert("?�?�된 ?�상??찾을 ???�습?�다.")
      return
    }
    const fileName = `${item.productName}_?�약_${item.id.slice(0, 12)}.webm`
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

  // ?�약 ??�� ??��
  const handleRemoveScheduled = (item: ShoppingScheduleItem) => {
    if (!confirm(`"${item.productName}" ?�약????��?�까??`)) return
    deleteShotFormScheduleVideoBlob(item.id).catch(() => {})
    persistScheduledItems(scheduledItems.filter((s) => s.id !== item.id))
  }

  const factoryPipelineScriptStartedRef = useRef(false)
  const factoryServerDownloadTriggeredRef = useRef<string | null>(null)
  const factoryPreviewAutoTriggeredRef = useRef<string | null>(null)

  // ?�동??모드: ?�당 ?�짜 ?�래 ???�동?�로 ?�상 ?�성 ?�작 (?�작 ?�면?�로 ?�동)
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

  // ?�동??모드: ?�품 ?�릭 ???�동 모드�?진입 (?�로?�트 ?�으�?불러?�기, ?�으�??�품 ?�보�?로드). ?�네?��? AI ?�성?�로 ?�정.
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
          if (data.selectedVoiceId) {
            setSelectedVoiceId(
              data.selectedVoiceId.startsWith("ttsmaker-")
                ? "elevenlabs-jB1Cifc2UQbq1gR3wnb0"
                : data.selectedVoiceId
            )
          }
          if (data.selectedSupertoneVoiceId) setSelectedSupertoneVoiceId(data.selectedSupertoneVoiceId)
          if (data.selectedSupertoneStyle) setSelectedSupertoneStyle(data.selectedSupertoneStyle)
          if (typeof data.ttsSpeed === "number") setTtsSpeed(data.ttsSpeed)
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
          if (data.subtitleStyle) setSubtitleStyle({
            ...DEFAULT_ANIMAL_SUBTITLE_STYLE,
            ...data.subtitleStyle,
            positionOffset: data.subtitleStyle?.positionOffset ?? 0,
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
        console.warn("[Factory] ?�로?�트 불러?�기 ?�패, ?�품 ?�보�?로드:", err)
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

  // ?�동??모드: 백그?�운?�에???�체 ?�이?�라???�행 (?�면 ?�환 ?�이 ?�동??모드??머물�?진행 ?�황�??�시)
  // �??�계 ?�료 ???�동?�로 ?�로?�트 ?�성·?�??  const runFactoryPipelineInBackground = async (item: FactoryScheduleItem) => {
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
        console.warn("[Factory] ?�로?�트 ?�계 ?�???�패:", e)
      }
    }

    try {
      const openaiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined
      const replicateKey = typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined
      if (!openaiKey) {
        updatePhase("product", "failed", "OpenAI API ?��? ?�습?�다.")
        return
      }

      const factoryCharacter = animalCharacter || createDefaultAnimalCharacter()

      updatePhase("script")
      const script = await generateShoppingScript(
        item.productName,
        item.productDescription ? `${item.productName}. ${item.productDescription}` : item.productName,
        openaiKey,
        12,
        factoryCharacter
      )
      const scenes = await splitScriptIntoScenes(script)
      if (scenes.length < 3) {
        updatePhase("script", "failed", "?��?분할 ?�패")
        return
      }

      // ?��??�료 ?? ?�로?�트 ?�동 ?�성 �?1?�계 ?�??      if (userId) {
        try {
          if (!projectId) {
            const projectName = `${item.productName} (?�약 ${item.scheduledDate} ${item.scheduledTime || "00:00"})`
            const initialData: ShoppingProjectData = {
              animalCharacter: factoryCharacter,
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
            await saveProjectStep({ script, animalCharacter: factoryCharacter, activeStep: "script" })
          }
        } catch (e) {
          console.warn("[Factory] ?�로?�트 ?�성/?�???�패:", e)
        }
      }

      updatePhase("video")
      if (!replicateKey) {
        updatePhase("video", "failed", "Replicate API ?��? ?�습?�다.")
        return
      }
      // 메인 ?�로?��? ?�일?�게 ?��?지???�롬?�트�?먼�? ?�성 (?��??�스?��? 그�?�??�면 nano-banana가 ?�패??
      let imagePromptsForFactory: Array<{ type: string; prompt: string; description: string; scriptText: string }> = []
      try {
        imagePromptsForFactory = await generateImagePromptsFromScript(
          script,
          item.productName,
          item.productDescription || "",
          item.productImageBase64 || undefined,
          openaiKey,
          factoryCharacter
        )
      } catch (promptErr) {
        console.warn("[Factory] ?��?지 ?�롬?�트 ?�성 ?�패, ?�면 ?�스?�로 ?��?", promptErr)
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
          "9:16",
          factoryCharacter
        )
        imageUrls.push(url)
      }
      await saveProjectStep({ imageUrls, activeStep: "video" })

      updatePhase("tts")
      const ttsText = script.trim()
      let ttsResponse: Response
      const voiceId = item.voiceId
      const factorySpeed = 1.05
      if (voiceId.startsWith("supertonic-")) {
        const sid = voiceId.replace("supertonic-", "")
        ttsResponse = await fetch("/api/supertonic-tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: ttsText, voiceId: sid, speed: factorySpeed, lang: "ko" }),
        })
      } else if (voiceId.startsWith("supertone-")) {
        const sid = voiceId.replace("supertone-", "")
        const supertoneKey = (localStorage.getItem("shotform_supertone_api_key") || "").trim()
        if (!supertoneKey) {
          updatePhase("tts", "failed", "?�퍼??API ?��? ?�습?�다.")
          return
        }
        ttsResponse = await fetch("/api/supertone-tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: ttsText,
            voiceId: sid,
            apiKey: supertoneKey,
            style: "neutral",
            language: "ko",
            speed: factorySpeed,
          }),
        })
      } else if (voiceId.startsWith("typecast-")) {
        const tid = voiceId.replace("typecast-", "")
        const typecastKey = (
          localStorage.getItem("shotform_typecast_api_key") ||
          localStorage.getItem("typecast_api_key") ||
          ""
        ).trim()
        if (!typecastKey) {
          updatePhase("tts", "failed", "?�?�캐?�트 API ?��? ?�습?�다.")
          return
        }
        ttsResponse = await fetch("/api/typecast-tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: ttsText,
            voiceId: tid,
            apiKey: typecastKey,
            emotion: "normal",
            speed: factorySpeed,
          }),
        })
      } else if (voiceId.startsWith("elevenlabs-")) {
        const eid = voiceId.replace("elevenlabs-", "")
        const elevenKey = (localStorage.getItem("shotform_elevenlabs_api_key") || "").trim()
        if (!elevenKey) {
          updatePhase("tts", "failed", "ElevenLabs API ?��? ?�습?�다.")
          return
        }
        ttsResponse = await fetch("/api/elevenlabs-tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: ttsText, voiceId: eid, apiKey: elevenKey, speed: factorySpeed }),
        })
      } else if (voiceId.startsWith("ttsmaker-")) {
        updatePhase("tts", "failed", "TTSMaker?????�상 지?�하지 ?�습?�다. ElevenLabs ?�으�?바꿔주세??")
        return
      } else {
        updatePhase("tts", "failed", "지?�하지 ?�는 목소리입?�다.")
        return
      }
      if (!ttsResponse.ok) {
        const err = await ttsResponse.json().catch(() => ({}))
        updatePhase("tts", "failed", err.error || "TTS ?�성 ?�패")
        return
      }
      const ttsData = await ttsResponse.json()
      if (!ttsData.audioBase64 && !ttsData.audioUrl) {
        updatePhase("tts", "failed", ttsData.error || "TTS ?�디???�음")
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
          console.warn("[Factory] TTS ?�로???�???�패:", e)
        }
      }
      const totalChars = script.length
      const scriptLines: ScriptLine[] = []
      let currentTime = 0
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i]
        const sentences = scene.split(/[.!??�！�?\s*/).filter((s) => s.trim().length > 0)
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
        const animalVideoPrompt = await generateVideoPromptForImage(
          i as 0 | 1 | 2,
          item.productName,
          item.productDescription,
          4,
          openaiKey,
          factoryCharacter
        )
        const vurl = await convertImageToVideoWithWan(imageUrls[i], animalVideoPrompt, undefined, replicateKey)
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
        console.warn("[Factory] AI ?�네???�성 ?�패, ?�품 ?��?지�?진행:", thumbErr)
        thumbUrl = item.productImageBase64?.startsWith("data:")
          ? item.productImageBase64
          : item.productImageBase64
            ? `data:image/jpeg;base64,${item.productImageBase64}`
            : ""
      }
      if (!thumbUrl) {
        throw new Error("?�네?�을 ?�성?????�고 ?�품 ?��?지???�습?�다.")
      }

      updatePhase("preview")
      await saveProjectStep({ activeStep: "preview" })

      // ?�네???�료 ??곧바�??�버 ?�더�??�행 ??PC ?�운로드 ???�튜�??�로??(?�라?�언??미리보기 ?�략)
      const durationSec = actualAudioDuration
      const getBlobFromUrl = async (url: string): Promise<Blob> => {
        if (url.startsWith("data:")) {
          const res = await fetch(url)
          return res.blob()
        }
        const res = await fetch(url)
        if (!res.ok) throw new Error(`?�운로드 ?�패: ${url}`)
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
        throw new Error(errData.error || `?�더 ?�청 ?�패: ${renderRes.status}`)
      }
      const result = await renderRes.json()
      const videoUrl = result.videoUrl
      const videoBase64 = result.videoBase64
      let serverBlob: Blob
      if (videoUrl) {
        const videoRes = await fetch(videoUrl)
        if (!videoRes.ok) throw new Error("?�더???�상 ?�운로드 ?�패")
        serverBlob = await videoRes.blob()
      } else if (videoBase64) {
        const binary = atob(videoBase64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        serverBlob = new Blob([bytes], { type: "video/mp4" })
      } else {
        throw new Error("?�답??videoUrl ?�는 videoBase64가 ?�습?�다.")
      }
      await saveShotFormScheduleVideoBlob(item.id, serverBlob)

      // 기기�??�일 ?�??(모바?? 공유/??�? PC: ?�운로드)
      const factoryFileName = `${item.productName}_공장_${item.id.slice(0, 8)}.mp4`
      const downloadUrl = URL.createObjectURL(serverBlob)
      const isMobileDevice = typeof navigator !== "undefined" && (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (typeof window !== "undefined" && window.innerWidth <= 768))
      if (isMobileDevice) {
        const file = new File([serverBlob], factoryFileName, { type: "video/mp4" })
        if (typeof navigator !== "undefined" && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: factoryFileName, text: "?�더링된 ?�상" })
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

      // ?�튜�??�로?�용 ?�목·?�명·?�그 ?�성 (백그?�운?�에?�는 ??�� ?�기???�성)
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
        console.warn("[Factory] ?�튜�?메�??�이???�성 ?�패, ?�품명만 ?�용:", metaErr)
      }

      let youtubeUploaded = false
      const channelName = typeof window !== "undefined" ? localStorage.getItem("shopping_animal_factory_youtube_channel") : null
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
          const clientId = typeof window !== "undefined" ? localStorage.getItem("shopping_animal_factory_youtube_client_id") : null
          const clientSecret = typeof window !== "undefined" ? localStorage.getItem("shopping_animal_factory_youtube_client_secret") : null
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
      console.error("[Factory] 백그?�운???�이?�라???�패:", e)
      setFactorySchedules((prev) => {
        const next = prev.map((s) =>
          s.id === item.id ? { ...s, status: "failed" as const, errorMessage: e instanceof Error ? e.message : String(e) } : s
        )
        localStorage.setItem(FACTORY_SCHEDULES_STORAGE_KEY, JSON.stringify(next))
        return next
      })
    }
  }

  // ?�동??모드 ?? ??번에 ?�나?�만 백그?�운???�이?�라???�행 (?�차 처리)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queue�?반응, pipeline ?�수??최신 ?�로?� ?�용
  }, [factoryPipelineQueue])

  useEffect(() => {
    if (!factoryAutoRunItem || factoryPipelineScriptStartedRef.current || activeStep !== "product") return
    if (!productName) return
    factoryPipelineScriptStartedRef.current = true
    handleGenerateScript()
  }, [factoryAutoRunItem, activeStep, productName])

  // ?�동??모드: ?�네??준비되�??�동?�로 미리보기 ?�계�??�동 (버튼 ?�릭 ?�이)
  useEffect(() => {
    if (!factoryAutoRunItem || activeStep !== "thumbnail") return
    const thumbReady = thumbnailUrl || thumbnailImages.length > 0
    if (!thumbReady || convertedVideoUrls.size !== 3 || !ttsAudioUrl) return
    setActiveStep("preview")
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ?�동 진행??  }, [factoryAutoRunItem?.id, activeStep, thumbnailUrl, thumbnailImages.length, convertedVideoUrls.size, ttsAudioUrl])

  // ?�동??모드: 미리보기 ?�계 진입 ??미리보기 ?�성 ?�동 ?�행 (??번만)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref�???번만 ?�출
  }, [factoryAutoRunItem?.id, activeStep, previewGenerated, isGeneratingPreview, convertedVideoUrls.size, ttsAudioUrl])

  // ?�동??모드: 미리보기 ?�성 ?�료 ???�버 ?�운로드(?�더) ?�동 ?�작 (??번만)
  useEffect(() => {
    if (!factoryAutoRunItem) {
      factoryServerDownloadTriggeredRef.current = null
      return
    }
    if (activeStep !== "preview" || !previewGenerated || isServerDownloading) return
    if (factoryServerDownloadTriggeredRef.current === factoryAutoRunItem.id) return
    factoryServerDownloadTriggeredRef.current = factoryAutoRunItem.id
    handleServerDownload()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref 방�?�???번만 ?�출
  }, [factoryAutoRunItem?.id, activeStep, previewGenerated, isServerDownloading])

  const handleDownload = () => {
    if (!videoUrl) return

    const mobile = isMobile()
    
    if (mobile) {
      // 모바?�에?�는 ??창에???�기 ?�는 공유 기능 ?�용
      try {
        // iOS Safari?�서???�운로드가 ?�한?��?�???창에???�기
        const newWindow = window.open(videoUrl, "_blank")
        if (!newWindow) {
          // ?�업??차단??경우 ?�용?�에�??�림
          alert("모바?�에?�는 ?�상????창에???�어 ?�운로드?�거??공유?????�습?�다.\n\n?�상 URL??복사?�여 ?�용?�세??")
          // URL 복사 기능 ?�공
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(videoUrl).then(() => {
              alert("?�상 URL???�립보드??복사?�었?�니??")
            }).catch(() => {
              // 복사 ?�패 ??URL ?�시
              prompt("?�상 URL (복사?�세??:", videoUrl)
            })
          } else {
            prompt("?�상 URL (복사?�세??:", videoUrl)
          }
        }
      } catch (error) {
        console.error("?�운로드 ?�패:", error)
        alert("모바?�에?�는 ?�상 ?�운로드가 ?�한?????�습?�다.\n\n?�상 URL??복사?�여 ?�용?�세??")
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(videoUrl).then(() => {
            alert("?�상 URL???�립보드??복사?�었?�니??")
          }).catch(() => {
            prompt("?�상 URL (복사?�세??:", videoUrl)
          })
        } else {
          prompt("?�상 URL (복사?�세??:", videoUrl)
        }
      }
    } else {
      // ?�스?�톱?�서???�반 ?�운로드
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
            <Card className="overflow-hidden rounded-2xl border border-[rgba(41,36,27,0.12)] bg-[#f7fffc]/95 shadow-2xl">
              <CardHeader className="relative z-10 border-b border-[rgba(41,36,27,0.1)] pb-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-[#305931]/30 bg-[#305931]/15 p-2 shadow-sm">
                    <PawPrint className="h-5 w-5 text-[#305931]" />
                  </div>
                  <div>
                    <p className="animal-bubble-chip inline-flex px-2.5 py-1 text-[10px]">?�� CASTING</p>
                    <CardTitle className="animal-display mt-2 text-xl font-bold text-[#221c16]">
                      1. 귀?�운 캐릭??만들�?                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 space-y-5 py-6">
                <p className="text-sm leading-6 text-[#49554b]">
                  먼�? ?�리 가게의 귀?�운 친구�?골라?? ?�퍼?�스�?만들�??�면마다 ?�굴?????�같???��???
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {ANIMAL_CHARACTER_PRESETS.map((preset) => {
                    const selected = animalCharacter.presetId === preset.id
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectCharacterPreset(preset.id)}
                        className={`overflow-hidden rounded-2xl border text-left transition ${
                          selected
                            ? "border-[#1d4594]/50 bg-[#85b6ff]/15 shadow-lg shadow-[#ff8fab]/20 scale-[1.02]"
                            : "border-[rgba(34,28,22,0.1)] bg-black/25 hover:border-[#005835]/40 hover:scale-[1.01]"
                        }`}
                      >
                        <div className="relative aspect-square w-full bg-gradient-to-br from-[#7dd3a8]/15 to-[#85b6ff]/10">
                          {preset.sampleImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={preset.sampleImage}
                              alt={`${preset.label} ?�플`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[#49554b]">
                              <span className="text-3xl">{preset.emoji}</span>
                              <span className="text-[10px] font-medium">직접 만들�?/span>
                            </div>
                          )}
                          {selected ? (
                            <span className="absolute right-1.5 top-1.5 rounded-full bg-[#85b6ff] px-1.5 py-0.5 text-[9px] font-bold text-[#181818] shadow">
                              ?�택
                            </span>
                          ) : null}
                        </div>
                        <div className="px-2.5 py-2.5">
                          <p className="flex items-center gap-1 text-sm font-bold text-[#29241b]">
                            <span>{preset.emoji}</span>
                            {preset.label}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-[#49554b]">
                            {preset.character.personality}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-[#2d342e]">캐릭???�름</Label>
                    <Input
                      value={animalCharacter.name}
                      onChange={(e) => handleUpdateCharacterField("name", e.target.value)}
                      placeholder="?? ?�비"
                      className="h-11 border-[rgba(41,36,27,0.12)] bg-black/35 text-[#29241b]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-[#2d342e]">?�격 / ??/Label>
                    <Input
                      value={animalCharacter.personality}
                      onChange={(e) => handleUpdateCharacterField("personality", e.target.value)}
                      placeholder="?? 진�????�보�?고양??
                      className="h-11 border-[rgba(41,36,27,0.12)] bg-black/35 text-[#29241b]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-[#2d342e]">
                    ?�형 ?�명 {animalCharacter.presetId === "custom" ? <span className="text-[#aa4426]">*</span> : null}
                  </Label>
                  <Input
                    value={animalCharacter.breedOrLook}
                    onChange={(e) => handleUpdateCharacterField("breedOrLook", e.target.value)}
                    placeholder="?? 주황??줄무????�� 고양??
                    className="h-11 border-[rgba(41,36,27,0.12)] bg-black/35 text-[#29241b]"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={handleGenerateCharacterReference}
                        disabled={isGeneratingCharacterRef}
                        className="animal-cta-cute rounded-full font-semibold"
                      >
                        {isGeneratingCharacterRef ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            만드??�?..
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            AI�?귀?�운 ?�굴 만들�?                          </>
                        )}
                      </Button>
                      <label className="inline-flex cursor-pointer items-center rounded-md border border-[rgba(41,36,27,0.14)] bg-white/[0.03] px-3 py-2 text-sm font-medium text-[#49554b] hover:bg-white/[0.08] hover:text-[#29241b]">
                        <ImageIcon className="mr-2 h-4 w-4" />
                        ?��?지 ?�로??                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleCharacterReferenceUpload}
                        />
                      </label>
                      {animalCharacter.referenceImage ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setAnimalCharacter((prev) => ({ ...prev, referenceImage: undefined }))
                          }
                          className="border-[rgba(41,36,27,0.14)] text-[#49554b]"
                        >
                          ?�퍼?�스 ?�거
                        </Button>
                      ) : null}
                    </div>
                    <p className="text-xs text-[#657468]">
                      ?�리???�플??기본 ?�퍼?�스�??�어가?? AI�??�시 만들거나 ?�로?�하�??�굴????고정?�요.
                    </p>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-[rgba(41,36,27,0.12)] bg-black/40">
                    {animalCharacter.referenceImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={animalCharacter.referenceImage}
                        alt={`${animalCharacter.name} ?�퍼?�스`}
                        className="h-44 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-44 flex-col items-center justify-center gap-2 text-[#657468]">
                        <PawPrint className="h-8 w-8" />
                        <span className="text-xs">?�퍼?�스 ?�음</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-2xl border border-[rgba(41,36,27,0.12)] bg-[#f7fffc]/95 shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-[#7dd3a8]/5 to-[#85b6ff]/5 pointer-events-none" />
              <CardHeader className="relative z-10 border-b border-[rgba(41,36,27,0.1)] pb-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-[#1d4594]/30 bg-[#85b6ff]/15 p-2 shadow-sm">
                    <ShoppingBag className="h-5 w-5 text-[#1d4594]" />
                  </div>
                  <div>
                    <p className="animal-bubble-chip inline-flex px-2.5 py-1 text-[10px]">?���?SHOPPING</p>
                    <CardTitle className="animal-display mt-2 text-xl font-bold text-[#221c16]">
                      2. ?�볼 ?�품 고르�?                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 space-y-6 py-6">
                <AnimalCoupangSearchPanel
                  characterName={animalCharacter.name}
                  searchQuery={coupangSearchQuery}
                  products={coupangProducts}
                  selectedProductId={selectedCoupangProduct?.productId ?? null}
                  isSearching={isSearchingCoupang}
                  searchError={coupangSearchError}
                  onSearchQueryChange={setCoupangSearchQuery}
                  onSearch={searchCoupangProducts}
                  onSelectProduct={handleSelectCoupangProduct}
                />

                {selectedCoupangProduct ? (
                  <div className="rounded-xl border border-[#1d4594]/30 bg-[#85b6ff]/10 px-4 py-3">
                    <p className="text-sm font-semibold text-[#221c16]">
                      ??{animalCharacter.name}???�핑 ?�이?? {selectedCoupangProduct.productName}
                    </p>
                    <p className="mt-1 text-xs text-[#49554b]">
                      쿠팡?�서 고른 ???�품???�고·?�용?�는 ?�면?�로 ?�본·이미�?·?�상??만들?�져??                    </p>
                  </div>
                ) : null}

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="product-name" className="flex items-center gap-2 text-sm font-semibold text-[#2d342e]">
                      ?�품�?<span className="text-[#aa4426]">*</span>
                    </Label>
                  </div>
                  <p className="text-xs text-[#657468]">?? 무선 블루?�스 ?�어??· 쿠팡 검?�으�??�동 ?�력?�요</p>
                  <Input
                    id="product-name"
                    placeholder="?�품명을 ?�력?�주?�요"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="h-12 border-[rgba(41,36,27,0.12)] bg-black/35 text-[#29241b] placeholder:text-[#657468] focus:border-[#005835]/50"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="product-description" className="text-sm font-semibold text-[#2d342e]">
                    ?�품 ?�명 (?�택?�항)
                  </Label>
                  <p className="text-xs text-[#657468]">
                    ?�품??주요 ?�징, ?�점 ?�을 ?�력?�주?�요. 비워?�면 ?�품명만?�로 ?�본을 ?�성?�니??
                  </p>
                  <Textarea
                    id="product-description"
                    placeholder="?�품 ?�명???�력?�주?�요"
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    rows={4}
                    className="resize-none border-[rgba(41,36,27,0.12)] bg-black/35 text-[#29241b] placeholder:text-[#657468] focus:border-[#005835]/50"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="video-duration" className="text-sm font-semibold text-[#2d342e]">
                    ?�상 길이
                  </Label>
                  <p className="text-xs text-[#657468]">
                    ?�상 길이�??�택?�세?? ?�택??길이??맞춰 ?�본이 ?�성?�니??
                  </p>
                  <Select value={videoDuration.toString()} onValueChange={(value) => setVideoDuration(parseInt(value) as 12 | 15 | 20 | 30)}>
                    <SelectTrigger className="h-12 border-[rgba(41,36,27,0.12)] bg-black/35 text-[#29241b]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[rgba(41,36,27,0.12)] bg-[#f7fffc] shadow-xl">
                      <SelectItem value="12" className="text-[#29241b]">12�?/SelectItem>
                      <SelectItem value="15" className="text-[#29241b]">15�?/SelectItem>
                      <SelectItem value="20" className="text-[#29241b]">20�?/SelectItem>
                      <SelectItem value="30" className="text-[#29241b]">30�?/SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="product-image" className="flex items-center gap-2 text-sm font-semibold text-[#2d342e]">
                    ?�품 ?��?지 <span className="text-[#aa4426]">*</span>
                  </Label>
                  {!productImage ? (
                    <div
                      className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 md:p-12 ${
                        isDragging
                          ? "scale-[1.02] border-[#005835] bg-[#7dd3a8]/10"
                          : "border-[rgba(0,88,53,0.3)] bg-[#7dd3a8]/5 hover:border-[#005835]/50"
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
                        className="flex cursor-pointer flex-col items-center gap-4"
                      >
                        <div className={`rounded-2xl p-4 transition-all ${isDragging ? "bg-[#7dd3a8]/20" : "bg-[#7dd3a8]/10"} shadow-sm`}>
                          <ImageIcon className={`h-12 w-12 ${isDragging ? "text-[#005835]" : "text-[#005835]/80"}`} />
                        </div>
                        <div className="space-y-2">
                          <span className={`block text-sm font-semibold md:text-base ${isDragging ? "text-[#005835]" : "text-[#2d342e]"}`}>
                            {isDragging ? "?�기???��?지�??�아주세?? : "?�품 ?��?지�??�로?�하거나 쿠팡?�서 ?�택?�세??}
                          </span>
                          <span className="block text-xs text-[#657468]">
                            ?��?지�??�릭?�거???�래그하???�로??                          </span>
                          <span className="block text-xs text-[#657468]">
                            PNG, JPG, GIF (최�? 10MB)
                          </span>
                        </div>
                      </label>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="relative h-64 w-full overflow-hidden rounded-2xl border-2 border-[rgba(0,88,53,0.3)] bg-white/95 shadow-xl">
                        <img
                          src={productImageDisplayUrl(productImage)}
                          alt="?�품 ?��?지"
                          className="h-full w-full object-contain"
                        />
                        <button
                          onClick={handleRemoveImage}
                          className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-red-500 to-red-600 p-2.5 text-white shadow-lg transition-all hover:scale-110 hover:from-red-600 hover:to-red-700"
                          type="button"
                          aria-label="?��?지 ?�거"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-3 text-center text-xs text-[#657468]">
                        {selectedCoupangProduct
                          ? `${animalCharacter.name}??가) ??쿠팡 ?�품???�고 ?�핑?�는 ?�면?�로 ?�성?�니??
                          : "?��?지가 ?�로?�되?�습?�다. ?�른 ?��?지�??�로?�하?�면 ?�거 ???�시 ?�로?�하?�요."}
                      </p>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-red-300">
                      <X className="h-4 w-4" />
                      <span className="text-sm font-medium">{error}</span>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleGenerateScript}
                  disabled={!productName.trim() || !productImage || isGeneratingScript}
                  className="animal-cta-cute h-14 w-full rounded-xl text-base font-bold disabled:cursor-not-allowed disabled:opacity-50"
                  size="lg"
                >
                  {isGeneratingScript ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      AI가 ?�본을 ?�성?�고 ?�습?�다...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      {selectedCoupangProduct
                        ? `${animalCharacter.name}??가) 쿠팡 ?�품 ?�고 ?��?만들�?
                        : "?��??�성?�기"}
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
                ?�성???��?              </h2>
              <p className="text-slate-600 text-base">?�본을 ?�인?�고 ?�정?????�습?�다</p>
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
                      ?��?({videoDuration}�?
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
                        ?�집
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
                          ?�??                        </Button>
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
                          ?�생??�?..
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          ?��??�생??                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 relative z-10">
                {/* ?�체 ?��??�시 */}
                <div>
                  <Label className="text-sm font-semibold text-slate-700 mb-2 block">?�체 ?��?/Label>
                  <Textarea
                    value={isEditingScript ? editedScript : script}
                    onChange={(e) => isEditingScript ? setEditedScript(e.target.value) : setScript(e.target.value)}
                    rows={8}
                    className="font-medium bg-gradient-to-br from-orange-50/90 to-amber-50/70 border-orange-200 text-slate-900 placeholder:text-slate-400 focus:border-orange-400 focus:ring-orange-400/20 resize-none shadow-sm"
                    placeholder="?�본이 ?�기???�시?�니??.."
                    disabled={!isEditingScript && !script}
                  />
                </div>
                
                {isAnalyzingScript && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>?�본을 분석?�고 ?�습?�다...</span>
                  </div>
                )}
                
                {/* ?��??�트�?분석 결과 */}
                {script && scriptParts.length > 0 && !isEditingScript && (
                  <div className="space-y-3 pt-4 border-t border-orange-100">
                    <Label className="text-sm font-semibold text-slate-700 mb-3 block">?��?분석</Label>
                    <div className="space-y-3">
                      {scriptParts.map((part, index) => {
                        const partColors: Record<string, { bg: string; border: string; text: string; label: string }> = {
                          "?�트�??�킹": { bg: "from-pink-50 to-rose-50", border: "border-pink-300", text: "text-pink-700", label: "?�트�??�킹" },
                          "?�품 ?�개": { bg: "from-blue-50 to-cyan-50", border: "border-blue-300", text: "text-blue-700", label: "?�품 ?�개" },
                          "?�품 ?�점": { bg: "from-green-50 to-emerald-50", border: "border-green-300", text: "text-green-700", label: "?�품 ?�점" },
                          "마무�?: { bg: "from-purple-50 to-indigo-50", border: "border-purple-300", text: "text-purple-700", label: "마무�? },
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
                                {part.text.length}??                              </span>
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

                <AnimalVoicePanel
                  script={script}
                  characterName={animalCharacter.name}
                  ttsAudioUrl={ttsAudioUrl}
                  selectedVoiceId={selectedVoiceId}
                  selectedStyle={selectedSupertoneStyle}
                  ttsSpeed={ttsSpeed}
                  isGeneratingTTS={isGeneratingTTS}
                  ttsProgress={ttsProgress}
                  onVoiceChange={(voiceId) => {
                    setSelectedVoiceId(voiceId)
                    if (voiceId.startsWith("supertone-")) {
                      setSelectedSupertoneVoiceId(voiceId.replace("supertone-", ""))
                    } else {
                      setSelectedSupertoneVoiceId("")
                    }
                    if (voiceId.startsWith("elevenlabs-")) {
                      setCustomElevenLabsVoiceId(voiceId.replace("elevenlabs-", ""))
                    }
                  }}
                  onStyleChange={setSelectedSupertoneStyle}
                  onSpeedChange={setTtsSpeed}
                  onGenerate={handleGenerateTTS}
                  onSupertoneVoicesLoaded={setSupertoneVoices}
                />

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setActiveStep("product")}
                    className="flex-1 border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 hover:from-orange-100 hover:to-amber-100 hover:text-orange-800 hover:border-orange-400 font-semibold shadow-md transition-all"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    ?�전
                  </Button>
                  <Button
                    onClick={handleGoToImageGeneration}
                    disabled={!script.trim()}
                    className="flex-1 bg-gradient-to-r from-green-500 via-emerald-500 to-green-500 hover:from-green-400 hover:via-emerald-400 hover:to-green-400 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/50 hover:shadow-xl hover:shadow-green-500/50 transition-all duration-300"
                    size="lg"
                  >
                    <ImageIcon className="w-5 h-5 mr-2" />
                    ?��?지 ?�성?�기
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
                ?��?지 ?�성
              </h2>
              <p className="text-slate-600 text-base">AI가 ?��?지�??�성?�니??/p>
            </div>

            {isGeneratingVideo ? (
              /* ?��?지 ?�성 ?�니메이?? ?�본 ?��?지가 ?�성???��?지�?변??*/
              productImage ? (
                <Card className="border border-green-200/50 rounded-2xl shadow-2xl bg-white/80 backdrop-blur-xl overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 to-emerald-50/30"></div>
                  <CardHeader className="relative z-10 border-b border-green-100">
                    <CardTitle className="text-xl font-bold text-slate-800">?��?지 ?�성 �?..</CardTitle>
                  </CardHeader>
                  <CardContent className="py-6 relative z-10">
                    <div className="flex items-center justify-center gap-8 flex-wrap">
                      {/* ?�본 ?��?지 */}
                      <div className="space-y-3 text-center">
                        <Label className="text-sm font-semibold text-slate-700">?�본 ?��?지</Label>
                        <div className="relative w-48 aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-blue-300 shadow-lg">
                          <img
                            src={productImage}
                            alt="?�본 ?�품 ?��?지"
                            className={`w-full h-full opacity-70 transition-opacity duration-1000 ${
                              productImageAspectRatio !== null && Math.abs(productImageAspectRatio - 1) < 0.1
                                ? "object-contain" // 1:1 비율???�는 축소?�서 ?�체 ?�시 (?�하 ?�백 ?��?)
                                : "object-cover" // �??�에??기존?��?                            }`}
                          />
                        </div>
                      </div>

                      {/* AI 변???�니메이??*/}
                      <div className="flex flex-col items-center justify-center relative">
                        {/* ?�살??*/}
                        <div className="relative">
                          <ArrowRight className="w-16 h-16 text-green-500 animate-pulse" />
                          {/* AI ?�성 ?�과 - Sparkles */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <Sparkles className="w-8 h-8 text-green-400 animate-bounce absolute -top-2 -left-2" style={{ animationDelay: '0s' }} />
                            <Sparkles className="w-6 h-6 text-emerald-400 animate-bounce absolute -top-1 -right-1" style={{ animationDelay: '0.2s' }} />
                            <Sparkles className="w-5 h-5 text-green-300 animate-bounce absolute -bottom-1 -left-1" style={{ animationDelay: '0.4s' }} />
                            <Sparkles className="w-7 h-7 text-emerald-300 animate-bounce absolute -bottom-2 -right-2" style={{ animationDelay: '0.6s' }} />
                          </div>
                          {/* ?�전?�는 로딩 �?*/}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                          {/* Bot ?�이�?*/}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Bot className="w-6 h-6 text-green-600 animate-pulse" />
                          </div>
                        </div>
                        <span className="text-xs text-slate-500 mt-3 font-medium">AI가 ?��?지�??�성 �?..</span>
                      </div>

                      {/* ?�성 중인 ?��?지 */}
                      <div className="space-y-3 text-center">
                        <Label className="text-sm font-semibold text-slate-700">?�성 �?..</Label>
                        <div className="relative w-48 aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-green-500 shadow-lg">
                          {/* 그라?�이??배경 ?�니메이??*/}
                          <div className="absolute inset-0 bg-gradient-to-br from-green-200/50 via-emerald-200/50 to-green-300/50 animate-pulse"></div>
                          {/* ?�티???�과 */}
                          <div className="absolute inset-0">
                            <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-green-400 rounded-full animate-ping" style={{ animationDelay: '0s' }}></div>
                            <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-emerald-400 rounded-full animate-ping" style={{ animationDelay: '0.3s' }}></div>
                            <div className="absolute bottom-1/4 left-1/2 w-2 h-2 bg-green-300 rounded-full animate-ping" style={{ animationDelay: '0.6s' }}></div>
                            <div className="absolute bottom-1/3 right-1/3 w-2 h-2 bg-emerald-300 rounded-full animate-ping" style={{ animationDelay: '0.9s' }}></div>
                          </div>
                          {/* 중앙 로딩 ?�피??*/}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="relative">
                              <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
                              <Sparkles className="w-4 h-4 text-green-400 absolute -top-1 -right-1 animate-bounce" />
                            </div>
                          </div>
                          {/* ?�단 ?�스??*/}
                          <div className="absolute bottom-2 left-2 right-2 text-[10px] text-green-600 font-medium bg-white/90 px-2 py-1 rounded text-center">
                            AI ?�성 �?..
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
                        <h3 className="text-xl font-semibold mb-2">?��?지 ?�성 �?..</h3>
                        <p className="text-muted-foreground mb-4">
                          AI가 ?��?지�??�성?�고 ?�습?�다
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            ) : imageUrls.length > 0 && productImage ? (
              /* ?�성 ?�료: ?�본 ?��?지?� ?�성??3?�의 ?��?지 */
              <Card className="border border-green-200/50 rounded-2xl shadow-2xl bg-white/80 backdrop-blur-xl overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 to-emerald-50/30"></div>
                <CardHeader className="relative z-10 border-b border-green-100">
                  <CardTitle className="text-xl font-bold text-slate-800">?��?지 ?�성 ?�료 (1??</CardTitle>
                </CardHeader>
                <CardContent className="py-6 relative z-10">
                  <div className="space-y-6">
                    {/* ?�본 ?��?지?� ?�성???��?지 좌우 배치 */}
                    <div className="flex items-center justify-center gap-8 flex-wrap">
                      {/* ?�본 ?��?지 */}
                      <div className="space-y-3 text-center">
                        <Label className="text-sm font-semibold text-slate-700">?�본 ?��?지</Label>
                        <div className="relative w-48 aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-blue-300 shadow-lg">
                          <img
                            src={productImage}
                            alt="?�본 ?�품 ?��?지"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>

                      {/* ?�살??*/}
                      <div className="flex flex-col items-center justify-center">
                        <ArrowRight className="w-16 h-16 text-green-500" />
                        <span className="text-xs text-slate-500 mt-2 font-medium">AI 변??/span>
                      </div>

                      {/* ?�성???��?지 (3�? */}
                      <div className="space-y-3 text-center">
                        <Label className="text-sm font-semibold text-slate-700">?�성???��?지 (3�?</Label>
                        <div className="flex gap-4 justify-center flex-wrap">
                          {imageUrls.map((url, index) => (
                            <div key={index} className="space-y-2">
                              <div className="flex items-center justify-center gap-2">
                                <Label className="text-xs font-medium text-slate-600">
                                  {imagePrompts[index]?.type || `?��?지 ${index + 1}`}
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
                                      ?�생??�?                                    </>
                                  ) : (
                                    <>
                                      <RefreshCw className="w-2.5 h-2.5 mr-1" />
                                      ?�생??                                    </>
                                  )}
                                </Button>
                              </div>
                              {/* 추�? ?�롬?�트 ?�력 ?�드 */}
                              <div className="space-y-1 w-48">
                                <Label className="text-[10px] text-slate-600">추�? ?�롬?�트</Label>
                                <Input
                                  type="text"
                                  placeholder="?? 밝�? 조명, ?�연?�러??배경"
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
                                      alt={`?�성???��?지 ${index + 1}`}
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
                                        ?�생??�?..
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <img
                                    src={url}
                                    alt={`?�성???��?지 ${index + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                                <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                                  {index + 1}
                                </div>
                                <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs font-medium px-2 py-1 rounded">
                                  {imagePrompts[index]?.type || `?��?지 ${index + 1}`}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* ?��?지 ?�롬?�트 ?�시 (Collapsible) */}
                    {imagePrompts.length > 0 && (
                      <div className="pt-4 border-t border-green-200">
                        <Collapsible>
                          <CollapsibleTrigger className="w-full group">
                            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all">
                              <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-blue-600" />
                                <span className="text-sm font-semibold text-blue-700">?��?지 ?�롬?�트 보기</span>
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
                                      <p className="text-xs font-medium text-slate-700 mb-1">?��?부�?</p>
                                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
                                        {prompt.scriptText}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-slate-700 mb-1">?�롬?�트:</p>
                                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 font-mono break-words">
                                        {prompt.prompt}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-slate-700 mb-1">?�명:</p>
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
                      ?�전
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
                          ?�생??�?..
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          ?�생??                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => setActiveStep("render")}
                      className="bg-gradient-to-r from-green-500 via-emerald-500 to-green-500 hover:from-green-400 hover:via-emerald-400 hover:to-green-400 text-white font-bold shadow-lg shadow-green-500/50 hover:shadow-xl hover:shadow-green-500/50 transition-all duration-300"
                      size="lg"
                    >
                      ?�음 ?�계�?                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* ?��?지 ?�성 ?�작 ?�면 */
              <Card className="border border-green-200/50 rounded-2xl shadow-2xl bg-white/80 backdrop-blur-xl overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 to-emerald-50/30"></div>
                <CardHeader className="relative z-10 border-b border-green-100">
                  <CardTitle className="text-xl font-bold text-slate-800">?��?지 ?�성 준�?/CardTitle>
                </CardHeader>
                <CardContent className="py-6 relative z-10">
                  {productImage ? (
                    <div className="space-y-6">
                      <div className="text-center">
                        <p className="text-slate-600 mb-4">?�로?�된 ?�품 ?��?지�?기반?�로 AI가 ?�로???��?지�??�성?�니??</p>
                        <div className="flex justify-center mb-6">
                          <div className="relative w-48 aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-green-300 shadow-lg">
                            <img
                              src={productImage}
                              alt="?�품 ?��?지"
                              className={`w-full h-full ${
                                productImageAspectRatio !== null && Math.abs(productImageAspectRatio - 1) < 0.1
                                  ? "object-contain" // 1:1 비율???�는 축소?�서 ?�체 ?�시 (?�하 ?�백 ?��?)
                                  : "object-cover" // �??�에??기존?��?                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* ?�롬?�트 ?�성 ?�계 */}
                      {!promptsGenerated ? (
                        <div className="space-y-4">
                          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                            <p className="text-sm text-blue-700 mb-3">
                              <strong>1?�계:</strong> ?�본을 분석?�여 ?��?지 ?�롬?�트�??�성?�니??
                            </p>
                            <Button
                              onClick={handleGenerateImagePrompts}
                              disabled={isGeneratingPrompts}
                              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-[#181818] font-semibold shadow-lg shadow-blue-500/50"
                              size="lg"
                            >
                              {isGeneratingPrompts ? (
                                <>
                                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                  ?�롬?�트 ?�성 �?..
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-5 h-5 mr-2" />
                                  ?��?지 ?�롬?�트 ?�성?�기
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* ?�성???�롬?�트 ?�시 */}
                          <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                            <div className="flex items-center gap-2 mb-3">
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                              <p className="text-sm font-semibold text-green-700">?�롬?�트 ?�성 ?�료 (3�?</p>
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
                                      <p className="text-xs font-medium text-slate-700 mb-1">?��?부�?</p>
                                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
                                        {prompt.scriptText}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-slate-700 mb-1">?�롬?�트:</p>
                                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 font-mono break-words">
                                        {prompt.prompt}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-slate-700 mb-1">?�명:</p>
                                      <p className="text-xs text-slate-500 italic">
                                        {prompt.description}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* ?��?지 ?�성 버튼 */}
                          <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                            <p className="text-sm text-purple-700 mb-3">
                              <strong>2?�계:</strong> ?�성???�롬?�트�??�용?�여 ?��?지�??�성?�니??
                            </p>
                            <Button
                              onClick={handleGenerateImage}
                              disabled={isGeneratingVideo}
                              className="w-full bg-gradient-to-r from-green-500 via-emerald-500 to-green-500 hover:from-green-400 hover:via-emerald-400 hover:to-green-400 text-[#181818] font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/50 hover:shadow-xl hover:shadow-green-500/50 transition-all duration-300"
                              size="lg"
                            >
                              {isGeneratingVideo ? (
                                <>
                                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                  ?��?지 ?�성 �?..
                                </>
                              ) : (
                                <>
                                  <ImageIcon className="w-5 h-5 mr-2" />
                                  ?��?지 ?�성?�기
                                </>
                              )}
                            </Button>
                          </div>

                          {/* ?�롬?�트 ?�생??버튼 */}
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
                            ?�롬?�트 ?�시 ?�성?�기
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-slate-600 mb-4">?�품 ?��?지가 ?�요?�니??</p>
                      <Button
                        onClick={() => setActiveStep("product")}
                        variant="outline"
                        className="border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 hover:from-green-100 hover:to-emerald-100 hover:text-green-800 hover:border-green-400 font-semibold shadow-md"
                      >
                        ?�품 ?�보�??�아가�?                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )

      case "preview":
        return (
          <div className="space-y-5">
            <div className="text-center space-y-2">
              <p className="animal-bubble-chip inline-flex px-2.5 py-1 text-[10px]">?�️ PET CAPCUT</p>
              <h2 className="animal-display text-3xl font-bold text-[#221c16]">캡컷 ?��????�집</h2>
              <p className="text-sm text-[#49554b]">?�?�라??· ?�막 · BGM/SFX · 미리보기 · ?�보?�기</p>
            </div>

            <AnimalCapCutEditWorkspace
              characterName={animalCharacter.name}
              previewGenerated={previewGenerated}
              hasVideos={convertedVideoUrls.size === 3}
              currentSubtitle={currentSubtitle}
              subtitleStyle={subtitleStyle}
              onSubtitleStyleChange={setSubtitleStyle}
              isPlaying={isPlaying}
              onTogglePlay={handlePreviewPlayPause}
              currentTime={currentTime}
              duration={previewAudio?.duration || 0}
              onSeekRatio={(ratio) => {
                if (!previewAudio || !previewAudio.duration) return
                const newTime = ratio * previewAudio.duration
                previewAudio.currentTime = newTime
                setCurrentTime(newTime)
                if (previewVideoRef.current) {
                  const video = previewVideoRef.current
                  const adjusted = Math.max(0, newTime - 0.0001)
                  if (!isNaN(video.duration) && video.duration > 0) {
                    video.currentTime = adjusted % video.duration
                  }
                }
              }}
              scriptLineCount={scriptLines.length}
              sceneCount={Math.max(1, convertedVideoUrls.size || 3)}
              bgmUrl={bgmUrl || undefined}
              bgmStartTime={bgmStartTime}
              bgmEndTime={bgmEndTime || previewAudio?.duration || 0}
              sfxUrl={sfxUrl || undefined}
              sfxStartTime={sfxStartTime}
              sfxEndTime={sfxEndTime || sfxStartTime + 1}
              isGeneratingPreview={isGeneratingPreview}
              onGeneratePreview={() => void handleGeneratePreview()}
              inspectorTab={editInspectorTab}
              onInspectorTabChange={setEditInspectorTab}
              previewMedia={
                <>
                  <video
                    ref={previewVideoRef}
                    crossOrigin="anonymous"
                    muted
                    playsInline
                    loop={false}
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{
                      opacity: videoTransitionOpacity,
                      transition: "opacity 0.05s ease-in-out",
                    }}
                  />
                  {previewThumbnailImage && currentTime < 0.01 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewThumbnailImage.src}
                      alt="?�네??
                      className="absolute inset-0 z-[5] h-full w-full object-cover"
                    />
                  ) : null}
                </>
              }
              audioPanel={
                <div className="space-y-5 text-[#2d342e]">
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">배경?�악 (BGM)</Label>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleBgmUpload}
                        className="flex-1 text-xs text-[#49554b] file:mr-3 file:rounded-full file:border-0 file:bg-[#7dd3a8]/20 file:px-3 file:py-1.5 file:text-[#005835]"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowBgmLibraryDialog(true)} className="border-[rgba(34,28,22,0.14)] text-[#2d342e]">
                        <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
                        ?�이브러�?                      </Button>
                    </div>
                    {bgmUrl ? (
                      <div className="space-y-2 rounded-xl border border-[#005835]/25 bg-[#7dd3a8]/10 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#005835]">BGM ?�용??/span>
                          <Button type="button" size="sm" variant="destructive" onClick={handleDeleteBgm}>??��</Button>
                        </div>
                        <audio controls src={bgmUrl} className="w-full" />
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <Label className="text-xs text-[#49554b]">BGM 볼륨 {Math.round(bgmVolume * 100)}%</Label>
                      <Slider value={[bgmVolume]} min={0} max={1} step={0.1} onValueChange={([v]) => setBgmVolume(v ?? 0.3)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-[#49554b]">TTS 볼륨 {Math.round(ttsVolume * 100)}%</Label>
                      <Slider value={[ttsVolume]} min={0} max={1} step={0.1} onValueChange={([v]) => setTtsVolume(v ?? 1)} />
                    </div>
                    {bgmUrl ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-[#49554b]">?�작(�?</Label>
                          <Input type="number" value={bgmStartTime} min={0} step={0.1} onChange={(e) => setBgmStartTime(Math.max(0, parseFloat(e.target.value) || 0))} className="mt-1 border-[rgba(41,36,27,0.12)] bg-black/35 text-[#29241b]" />
                        </div>
                        <div>
                          <Label className="text-xs text-[#49554b]">종료(�?</Label>
                          <Input type="number" value={bgmEndTime} min={0} step={0.1} onChange={(e) => setBgmEndTime(Math.max(0, parseFloat(e.target.value) || 0))} className="mt-1 border-[rgba(41,36,27,0.12)] bg-black/35 text-[#29241b]" />
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-3 border-t border-[rgba(34,28,22,0.08)] pt-4">
                    <Label className="text-sm font-semibold">?�과??(SFX)</Label>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleSfxUpload}
                        className="flex-1 text-xs text-[#49554b] file:mr-3 file:rounded-full file:border-0 file:bg-[#85b6ff]/20 file:px-3 file:py-1.5 file:text-[#1d4594]"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowSfxLibraryDialog(true)} className="border-[rgba(34,28,22,0.14)] text-[#2d342e]">
                        <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
                        ?�이브러�?                      </Button>
                    </div>
                    {sfxUrl ? (
                      <div className="space-y-2 rounded-xl border border-[#1d4594]/25 bg-[#85b6ff]/10 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#1d4594]">SFX ?�용??/span>
                          <Button type="button" size="sm" variant="destructive" onClick={handleDeleteSfx}>??��</Button>
                        </div>
                        <audio controls src={sfxUrl} className="w-full" />
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <Label className="text-xs text-[#49554b]">SFX 볼륨 {Math.round(sfxVolume * 100)}%</Label>
                      <Slider value={[sfxVolume]} min={0} max={1} step={0.1} onValueChange={([v]) => setSfxVolume(v ?? 0.5)} />
                    </div>
                    {sfxUrl ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-[#49554b]">?�작(�?</Label>
                          <Input type="number" value={sfxStartTime} min={0} step={0.1} onChange={(e) => setSfxStartTime(Math.max(0, parseFloat(e.target.value) || 0))} className="mt-1 border-[rgba(41,36,27,0.12)] bg-black/35 text-[#29241b]" />
                        </div>
                        <div>
                          <Label className="text-xs text-[#49554b]">종료(�?</Label>
                          <Input type="number" value={sfxEndTime} min={0} step={0.1} onChange={(e) => setSfxEndTime(Math.max(0, parseFloat(e.target.value) || 0))} className="mt-1 border-[rgba(41,36,27,0.12)] bg-black/35 text-[#29241b]" />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              }
              metaPanel={
                <div className="space-y-4 text-[#2d342e]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">?�튜�?메�??�이??/p>
                    <Button type="button" size="sm" onClick={() => void handleGenerateMetadata()} disabled={isGeneratingMetadata || !productName.trim()} className="animal-mint-btn rounded-full">
                      {isGeneratingMetadata ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                      AI ?�성
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-[#49554b]">?�목</Label>
                    <Input value={youtubeTitle} onChange={(e) => setYoutubeTitle(e.target.value)} className="border-[rgba(41,36,27,0.12)] bg-black/35 text-[#29241b]" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-[#49554b]">?�명</Label>
                    <Textarea value={youtubeDescription} onChange={(e) => setYoutubeDescription(e.target.value)} rows={4} className="resize-none border-[rgba(41,36,27,0.12)] bg-black/35 text-[#29241b]" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-[#49554b]">?�그</Label>
                    <Input value={youtubeTags.join(", ")} onChange={(e) => setYoutubeTags(e.target.value.split(",").map((t) => t.trim()).filter(Boolean))} className="border-[rgba(41,36,27,0.12)] bg-black/35 text-[#29241b]" placeholder="?�표�?구분" />
                  </div>
                </div>
              }
              exportActions={
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {videoUrl ? (
                    <Button onClick={handleDownload} className="bg-[#7dd3a8] text-[#f2fffb] hover:bg-[#6bc497]" size="lg">
                      <Download className="mr-2 h-4 w-4" />
                      ?�상 ?�운로드
                    </Button>
                  ) : (
                    <Button onClick={() => handleRenderVideo()} disabled={isRendering || !previewGenerated} className="bg-[#85b6ff] text-[#181818] hover:bg-[#71a9ff] disabled:opacity-50" size="lg">
                      {isRendering && !isScheduling ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />?�더�?�?..</>
                      ) : (
                        <><Download className="mr-2 h-4 w-4" />?�상 ?�운로드</>
                      )}
                    </Button>
                  )}
                  <Button onClick={handleServerDownload} disabled={!previewGenerated || isServerDownloading} variant="outline" className="border-[rgba(34,28,22,0.14)] text-[#2d342e]" size="lg">
                    {isServerDownloading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />?�버 ?�더�?�?..</>
                    ) : (
                      <><Download className="mr-2 h-4 w-4" />?�버 ?�운로드</>
                    )}
                  </Button>
                  {serverDownloadLink ? (
                    <a href={serverDownloadLink.url} download={serverDownloadLink.fileName} target="_blank" rel="noopener noreferrer" className="col-span-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#7dd3a8] py-3 font-semibold text-[#f2fffb]">
                      <Download className="h-5 w-5" />
                      ?�상 ?�??(??��???�운로드)
                    </a>
                  ) : null}
                  <Button onClick={handleOpenScheduleModal} disabled={isRendering || !previewGenerated} variant="outline" className="border-[#1d4594]/40 text-[#1d4594]" size="lg">
                    {isScheduling ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />?�약 ?�성 �?..</> : <><CalendarClock className="mr-2 h-4 w-4" />?�약 발행</>}
                  </Button>
                </div>
              }
            />

            <div className="flex gap-3 border-t border-[rgba(34,28,22,0.08)] pt-4">
              <Button variant="outline" onClick={() => setActiveStep("thumbnail")} className="flex-1 border-[rgba(34,28,22,0.14)] text-[#2d342e]">
                <ArrowLeft className="mr-2 h-4 w-4" />
                ?�전 · ?�네??              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setActiveStep("product")
                  setIsPlaying(false)
                  setCurrentTime(0)
                }}
                className="flex-1 animal-mint-btn"
              >
                <Home className="mr-2 h-4 w-4" />
                처음?�로
              </Button>
            </div>
          </div>
        )

      case "render":
        return (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                ?�상 ?�성
              </h2>
              <p className="text-slate-600 text-base">?�상 ?�정??구성?�고 ?�성?�세??/p>
            </div>

            {/* ?�성???�상 ?�시�??�시 */}
            {/* ?�상???�나?�도 ?�성 중이거나 ?�성??경우 ?�시 */}
            {(convertedVideoUrls.size > 0 || isConvertingToVideo.get(0) || isConvertingToVideo.get(1) || isConvertingToVideo.get(2)) && (
              <Card className="border border-blue-200 rounded-2xl shadow-lg bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="w-5 h-5 text-blue-600" />
                    개별 ?�상 ?�성 �?({convertedVideoUrls.size}/3)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[0, 1, 2].map((index) => {
                      const videoUrl = convertedVideoUrls.get(index)
                      const isConverting = isConvertingToVideo.get(index)
                      const isGeneratingPrompt = isGeneratingVideoPrompts.get(index)
                      const videoPrompt = videoPrompts.get(index)
                      const sceneNames = ["?�품 ?�용 ?�상", "?�테???�상", "?�른 배경 ?�상"]
                      
                      // ?�성 ?�료???�상
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
                                    ?�성 �?                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="w-3 h-3 mr-1" />
                                    ?�생??                                  </>
                                )}
                              </Button>
                            </div>
                            {/* ?�상 ?�롬?�트 ?�시 (Collapsible) */}
                            {videoPrompt && (
                              <Collapsible>
                                <CollapsibleTrigger className="w-full">
                                  <div className="flex items-center justify-between w-full p-2 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors">
                                    <span className="text-xs font-semibold text-blue-700">?�상 ?�롬?�트 보기</span>
                                    <ChevronDown className="w-4 h-4 text-blue-600" />
                                  </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <p className="text-xs font-medium text-slate-700 mb-1">?�롬?�트:</p>
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
                              <div className="absolute top-2 right-2 bg-green-500 text-[#181818] text-xs font-bold px-2 py-1 rounded-full shadow-md">
                                ??{index + 1}
                              </div>
                            </div>
                          </div>
                        )
                      }
                      
                      // ?�성 중인 ?�상
                      if (isConverting || isGeneratingPrompt) {
                        const statusText = isGeneratingPrompt 
                          ? "?�롬?�트 ?�성 �?.." 
                          : "?�상 ?�성 �?.."
                        
                        return (
                          <div key={index} className="space-y-2">
                            <Label className="text-sm font-semibold text-slate-700">{sceneNames[index]} ({statusText})</Label>
                            {/* ?�롬?�트 ?�성 중일 ???�롬?�트 ?�시 */}
                            {isGeneratingPrompt && (
                              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="flex items-center gap-2">
                                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                                  <p className="text-xs text-blue-600 font-medium">?�상 ?�롬?�트 ?�성�?/p>
                                </div>
                              </div>
                            )}
                            {/* ?�성???�롬?�트 ?�시 (?�상 ?�성 중일 ?? */}
                            {videoPrompt && !isGeneratingPrompt && (
                              <Collapsible>
                                <CollapsibleTrigger className="w-full">
                                  <div className="flex items-center justify-between w-full p-2 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors">
                                    <span className="text-xs font-semibold text-green-700">?�성???�롬?�트 보기</span>
                                    <ChevronDown className="w-4 h-4 text-green-600" />
                                  </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <p className="text-xs font-medium text-slate-700 mb-1">?�롬?�트:</p>
                                    <p className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-200 font-mono break-words max-h-40 overflow-y-auto">
                                      {videoPrompt}
                                    </p>
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            )}
                            <div className="relative w-full aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-blue-500 shadow-lg">
                              {/* ?�본 ?��?지 배경 */}
                              {imageUrls[index] && (
                                <img
                                  src={imageUrls[index]}
                                  alt={`?�본 ?��?지 ${index + 1}`}
                                  className="w-full h-full object-cover opacity-50"
                                />
                              )}
                              {/* 로딩 ?�버?�이 */}
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
                      
                      // ?�직 ?�작?��? ?��? ?�상 (?�본 ?��?지 ?�시)
                      return (
                        <div key={index} className="space-y-2">
                          <Label className="text-sm font-semibold text-slate-700">{sceneNames[index]} (?��?�?</Label>
                          <div className="relative w-full aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-300 shadow-lg">
                            {imageUrls[index] ? (
                              <img
                                src={imageUrls[index]}
                                alt={`?�본 ?��?지 ${index + 1}`}
                                className="w-full h-full object-cover opacity-70"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                <span className="text-gray-400 text-sm">?��?지 ?�음</span>
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
            

            {/* ?�상???�을 ??*/}
            {convertedVideoUrls.size === 0 && (
              <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    ?�성???��?지
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {imageUrls.length > 0 ? (
                    <div className="space-y-6">
                      {/* ?��?지 ?�시 (3�? */}
                      <div className="flex justify-center">
                        <div className="space-y-4 w-full max-w-4xl">
                          <Label className="text-sm font-semibold text-slate-700 text-center block">?�성???��?지 (3�?</Label>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {imageUrls.map((url, index) => (
                              <div key={index} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm font-semibold text-slate-700">
                                    {imagePrompts[index]?.type || `?��?지 ${index + 1}`}
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
                                        ?�생??�?                                      </>
                                    ) : (
                                      <>
                                        <RefreshCw className="w-3 h-3 mr-1" />
                                        ?�생??                                      </>
                                    )}
                                  </Button>
                                </div>
                                {/* 추�? ?�롬?�트 ?�력 ?�드 */}
                                <div className="space-y-1">
                                  <Label className="text-xs text-slate-600">추�? ?�롬?�트 (?�국??</Label>
                                  <Input
                                    type="text"
                                    placeholder="?? 밝�? 조명, ?�연?�러??배경, 고급?�러???�낌"
                                    value={customImagePrompts.get(index) || ""}
                                    onChange={(e) => {
                                      const newMap = new Map(customImagePrompts)
                                      newMap.set(index, e.target.value)
                                      setCustomImagePrompts(newMap)
                                    }}
                                    className="h-8 text-xs"
                                  />
                                  <p className="text-[10px] text-slate-500">
                                    ?�생????기존 ?�롬?�트??추�??�니??                                  </p>
                                </div>
                                <div className="relative w-full aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200 shadow-sm">
                                  {isRegeneratingImage.get(index) ? (
                                    <>
                                      <img
                                        src={url}
                                        alt={`?�성???��?지 ${index + 1}`}
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
                                          AI가 ?��?지�??�생??�?..
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <img
                                      src={url}
                                      alt={`?�성???��?지 ${index + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                                    {index + 1}
                                  </div>
                                  <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs font-medium px-2 py-1 rounded">
                                    {imagePrompts[index]?.type || `?��?지 ${index + 1}`}
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
                      <p className="text-slate-600 text-base">?��?지가 ?�성?��? ?�았?�니??</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ?�상 ?�성/?�생??버튼 */}
            {imageUrls.length > 0 && (
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setActiveStep("video")
                    // ?�상 ?�성 ?�태 초기??(?�계 ?�환 ??
                    setIsConvertingToVideo(new Map())
                  }}
                  className="flex-1 border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 hover:from-orange-100 hover:to-amber-100 hover:text-orange-800 hover:border-orange-400 font-semibold shadow-md transition-all"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  ?�전
                </Button>
                <Button
                  onClick={() => setActiveStep("thumbnail")}
                  disabled={convertedVideoUrls.size < 3}
                  className="flex-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 hover:from-purple-400 hover:via-pink-400 hover:to-purple-400 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/50 transition-all duration-300"
                  size="lg"
                >
                  ?�음
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                {/* ?�상 ?�성/?�생??버튼 */}
                {convertedVideoUrls.size === 3 ? (
                  // 모든 ?�상???�성??경우: ?�생??버튼
                  <Button
                    onClick={() => {
                      // ?�생????기존 ?�상 초기??                      setConvertedVideoUrls(new Map())
                      handleConvertAllImagesToVideos()
                    }}
                    disabled={isConvertingToVideo.size > 0}
                    className="flex-1 bg-gradient-to-r from-orange-500 via-red-500 to-orange-500 hover:from-orange-400 hover:via-red-400 hover:to-orange-400 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/50 hover:shadow-xl hover:shadow-orange-500/50 transition-all duration-300"
                    size="lg"
                  >
                    {isConvertingToVideo.size > 0 ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        AI가 ?�상???�성?�고 ?�습?�다...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-5 h-5 mr-2" />
                        ?�상 ?�생??                      </>
                    )}
                  </Button>
                ) : (
                  // ?�상???�거???��?�??�성??경우: ?�상 ?�성 버튼
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
                          <>개별 ?�상 ?�성 �?({convertedVideoUrls.size}/3)</>
                        ) : (
                          <>AI가 ?�상???�성?�고 ?�습?�다...</>
                        )}
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5 mr-2" />
                        {convertedVideoUrls.size > 0 ? (
                          <>?�상 ?�생??({convertedVideoUrls.size}/3 ?�료)</>
                        ) : (
                          <>?�상 ?�성</>
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
                ?�네???�성
              </h2>
              <p className="text-slate-600 text-base">?�츠 ?�네?�을 ?�성?�세??/p>
            </div>

            {/* ?�성 방식 ?�택 */}
            <Card className="border border-purple-200 rounded-2xl shadow-lg bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-purple-600" />
                  ?�네???�성 방식
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
                    AI ?�성
                  </Button>
                  <Button
                    onClick={() => setThumbnailMode("manual")}
                    variant={thumbnailMode === "manual" ? "default" : "outline"}
                    className={`flex-1 ${thumbnailMode === "manual" ? "bg-purple-500 hover:bg-purple-600 text-white" : ""}`}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    직접 ?�성
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* AI ?�성 모드 */}
            {thumbnailMode === "ai" && (
              <Card className="border border-purple-200 rounded-2xl shadow-lg bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    AI ?�네???�성
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-center items-start">
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-center text-gray-600">?�네??미리보기</h3>
                      <div className="relative" style={{ width: "300px", height: "533px" }}>
                        {thumbnailUrl ? (
                          <canvas
                            ref={thumbnailCanvasRef}
                            className="w-full h-full border-2 border-gray-300 rounded-lg"
                            style={{ aspectRatio: "9/16" }}
                          />
                        ) : (
                          <div className="w-full h-full border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                            <span className="text-gray-400 text-sm">?�네???�성 버튼???�러주세??/span>
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
                              ?�성 �?..
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              AI ?�네???�성
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

            {/* 직접 ?�성 모드 */}
            {thumbnailMode === "manual" && (
              <Card className="border border-purple-200 rounded-2xl shadow-lg bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-purple-600" />
                    직접 ?�네???�성
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* ?�쪽: ?��?지 ?�택 �??�스???�력 */}
                    <div className="space-y-4">
                      {/* ?��?지 ?�택 */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-slate-700">?��?지 ?�택</Label>
                        
                        {/* ?��?지 ?�로??*/}
                        <div className="space-y-2">
                          <Label className="text-xs text-slate-500">?��?지 ?�일 ?�로??/Label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleCustomThumbnailUpload}
                            className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-purple-500 file:to-pink-500 file:text-white hover:file:from-purple-400 hover:file:to-pink-400 file:cursor-pointer bg-white/80 border border-slate-200 rounded-lg p-2 shadow-sm"
                          />
                        </div>

                        {/* ?�성???��?지?�서 ?�택 */}
                        {imageUrls.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-xs text-slate-500">?��?지 ?�성 ?�계?�서 ?�성???��?지 ?�택</Label>
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
                                    alt={`?�성???��?지 ${index + 1}`}
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

                      {/* ?�스???�력 */}
                      {customThumbnailImage && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-slate-700">�?번째 �??�스??/Label>
                            <Input
                              value={customThumbnailText.line1}
                              onChange={(e) => setCustomThumbnailText({ ...customThumbnailText, line1: e.target.value })}
                              placeholder="�?번째 �??�스???�력"
                              className="bg-white/80 border-slate-200"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-slate-700">??번째 �??�스??/Label>
                            <Input
                              value={customThumbnailText.line2}
                              onChange={(e) => setCustomThumbnailText({ ...customThumbnailText, line2: e.target.value })}
                              placeholder="??번째 �??�스???�력"
                              className="bg-white/80 border-slate-200"
                            />
                          </div>

                          {/* ?�스???��????�정 */}
                          <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <Label className="text-sm font-semibold text-slate-700">?�스???��????�정</Label>
                            
                            {/* �?번째 �??�상 */}
                            <div className="space-y-2">
                              <Label className="text-xs text-slate-600">�?번째 �??�상</Label>
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

                            {/* ??번째 �??�상 */}
                            <div className="space-y-2">
                              <Label className="text-xs text-slate-600">??번째 �??�상</Label>
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

                            {/* 글???�기 */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-slate-600">글???�기</Label>
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

                            {/* ?�스???�치 */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-slate-600">?�스???�치</Label>
                                <span className="text-xs text-slate-500">
                                  {Math.round(customThumbnailTextStyle.position * 100)}% (?�단: 0%, ?�단: 100%)
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

                            {/* ?�두�??�정 */}
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs text-slate-600">?�두�??�께</Label>
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
                                  <Label className="text-xs text-slate-600">?�두�??�상</Label>
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

                            {/* ?��?지 ?��?/축소 */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-slate-600">?��?지 ?�기</Label>
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

                            {/* ?�스???�전 */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-slate-600">?�스???�전</Label>
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
                            ?�네???�??                          </Button>
                        </div>
                      )}
                    </div>

                    {/* ?�른�? 미리보기 */}
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
                            <span className="text-gray-400 text-sm">?��?지�??�로?�해주세??/span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ?�성???�네??목록 */}
            {thumbnailImages.length > 0 && (
              <Card className="border border-purple-200 rounded-2xl shadow-lg bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-purple-600" />
                    ?�성???�네??목록 ({thumbnailImages.length}�?
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
                          alt={`?�네??${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {selectedThumbnailIndex === index && (
                          <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-purple-600" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-[#181818] text-xs p-2">
                          {thumb.isCustom ? "직접 ?�성" : "AI ?�성"}
                        </div>
                      </div>
                    ))}
                  </div>
                  {selectedThumbnailIndex >= 0 && (
                    <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-sm text-purple-700">
                        ?�택???�네?? {selectedThumbnailIndex + 1}�?({thumbnailImages[selectedThumbnailIndex]?.isCustom ? "직접 ?�성" : "AI ?�성"})
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ?�비게이??버튼 */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setActiveStep("render")}
                className="flex-1 border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 hover:from-orange-100 hover:to-amber-100 hover:text-orange-800 hover:border-orange-400 font-semibold shadow-md transition-all"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                ?�전
              </Button>
              <Button
                onClick={() => setActiveStep("preview")}
                disabled={selectedThumbnailIndex === -1 || !thumbnailUrl}
                className="flex-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 hover:from-purple-400 hover:via-pink-400 hover:to-purple-400 text-[#181818] font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/50 transition-all duration-300"
                size="lg"
              >
                ?�음
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
    <div className="animal-shopping-dark relative min-h-screen overflow-hidden text-[#221c16]">
      {/* Cute pet studio atmosphere */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-28 top-[-80px] h-[520px] w-[520px] rounded-full bg-[#7dd3a8]/18 blur-[130px]" />
        <div className="absolute -right-24 bottom-[-60px] h-[540px] w-[540px] rounded-full bg-[#85b6ff]/16 blur-[140px]" />
        <div className="absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-[#293f69]/10 blur-[110px]" />
        <div
          className="absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 28%, rgba(255,246,238,.7) 1.4px, transparent 1.4px), radial-gradient(circle at 72% 58%, rgba(125,211,168,.55) 1.6px, transparent 1.6px)",
            backgroundSize: "44px 44px, 68px 68px",
          }}
        />
        <PawPrint className="animal-float absolute left-[8%] top-[18%] h-8 w-8 text-[#005835]/25" />
        <PawPrint className="animal-float absolute right-[12%] top-[28%] h-10 w-10 text-[#1d4594]/22" style={{ animationDelay: "0.8s" }} />
        <PawPrint className="animal-sparkle absolute left-[22%] bottom-[16%] h-7 w-7 text-[#293f69]/28" style={{ animationDelay: "1.2s" }} />
      </div>

      {/* Sticky studio bar (work mode) */}
      {!showProjectList ? (
        <header className="sticky top-0 z-50 border-b border-[rgba(34,28,22,0.1)] bg-[#f3ffff]/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">
            <div className="flex min-w-0 items-center gap-2 md:gap-3">
              <Link href="/WingsAIStudioShotForm">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full border border-[rgba(34,28,22,0.12)] bg-white/[0.04] text-[#3d4f47] hover:bg-white/[0.08] hover:text-[#221c16]"
                >
                  <Home className="mr-2 h-4 w-4" />
                  ??                </Button>
              </Link>
              <button
                type="button"
                onClick={() => setShowProjectList(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(34,28,22,0.12)] bg-white/[0.04] px-3 py-1.5 text-sm text-[#3d4f47] transition hover:border-[#005835]/4 hover:text-[#221c16]"
              >
                <FolderOpen className="h-4 w-4" />
                목록
              </button>
              {currentProject ? (
                <div className="min-w-0">
                  <p className="animal-display truncate text-sm font-semibold text-[#221c16]">
                    {currentProject.name}
                  </p>
                  <p className="text-[10px] font-extrabold tracking-[0.14em] text-[#005835]">
                    ?�� PET STUDIO · {animalCharacter.name}
                  </p>
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="animal-bubble-chip hidden items-center gap-1.5 px-3 py-1 text-[10px] sm:inline-flex">
                <PawPrint className="h-3.5 w-3.5" />
                CUTE SHOP
              </span>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (currentProject) {
                    void saveProject()
                  } else {
                    setShowCreateProjectDialog(true)
                    setNewProjectName("")
                    setNewProjectDescription("")
                  }
                }}
                disabled={isSavingProject || !currentProject}
                className="animal-cta-cute rounded-full px-4 font-semibold disabled:opacity-50"
              >
                {isSavingProject ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ?�??�?                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    ?�??                  </>
                )}
              </Button>
            </div>
          </div>
        </header>
      ) : null}

      <div className="relative z-10 mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
        {/* List-mode cute character stage */}
        {showProjectList ? (
          <div className="mb-8 md:mb-10">
            <div className="mb-5 flex items-center justify-between">
              <Link href="/WingsAIStudioShotForm">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full border border-[rgba(34,28,22,0.12)] bg-white/[0.04] text-[#3d4f47] hover:bg-white/[0.08] hover:text-[#221c16]"
                >
                  <Home className="mr-2 h-4 w-4" />
                  ?�으�?                </Button>
              </Link>
            </div>

            <div className="animal-stage-hero relative overflow-hidden rounded-[36px] border border-[rgba(34,28,22,0.14)] bg-[#e1f6f0]/95 shadow-2xl shadow-black/35">
              <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-[#7dd3a8]/18 via-[#85b6ff]/08 to-transparent" />
              <div className="absolute -right-10 top-6 h-48 w-48 rounded-full bg-[#85b6ff]/20 blur-[70px]" />
              <div className="absolute -left-8 bottom-0 h-40 w-40 rounded-full bg-[#7dd3a8]/18 blur-[60px]" />
              <div className="relative grid gap-8 p-7 md:p-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
                <div>
                  <p className="animal-display text-3xl font-bold text-[#221c16] md:text-4xl">
                    AI ?�물 ?�핑 ?�폼
                  </p>
                  <div className="animal-bubble-chip mt-4 inline-flex items-center gap-2 px-3 py-1.5 text-[10px]">
                    <PawPrint className="animal-wiggle h-3.5 w-3.5" />
                    PET CHARACTER STUDIO
                  </div>
                  <h1 className="animal-display mt-4 text-4xl font-bold leading-[1.15] text-[#221c16] md:text-5xl lg:text-[3.4rem]">
                    귀?�운 친구가
                    <br />
                    <span className="bg-gradient-to-r from-[#7dd3a8] via-[#293f69] to-[#85b6ff] bg-clip-text text-transparent">
                      ?�을 보러 가??
                    </span>
                  </h1>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-[#3d4f47]">
                    캐릭?��? 고르�? 마트?�서 ?�품??집는 9:16 바이???�폼??                    말랑말랑?????�튜?�오?�서 만들??보세??
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={() => {
                        setShowCreateProjectDialog(true)
                        setNewProjectName("")
                        setNewProjectDescription("")
                      }}
                      className="animal-cta-cute h-12 rounded-full px-6 text-base"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      ??촬영 ?�작
                    </Button>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-[28px] border border-[rgba(34,28,22,0.14)] bg-gradient-to-br from-[#7dd3a8]/10 via-black/20 to-[#85b6ff]/10 p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[10px] font-extrabold tracking-[0.16em] text-[#005835]">
                      CUTE PIPELINE
                    </p>
                    <span className="animal-sparkle text-lg">??/span>
                  </div>
                  <div className="space-y-3">
                    {[
                      ["?��", "캐릭??, "귀?�운 ?�퍼 만들�?],
                      ["?��", "?�연", "?�품 집고 반응?�기"],
                      ["?��", "?�폼", "9:16?�로 ?�보?�기"],
                    ].map(([emoji, title, desc], index) => (
                      <div
                        key={title}
                        className="flex items-center gap-3 rounded-[20px] border border-[rgba(34,28,22,0.1)] bg-[#f3ffff]/55 px-3 py-3"
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7dd3a8]/15 text-xl">
                          {emoji}
                        </span>
                        <div className="min-w-0">
                          <p className="animal-display text-sm font-semibold text-[#221c16]">
                            {String(index + 1).padStart(2, "0")} · {title}
                          </p>
                          <p className="text-xs text-[#3d4f47]">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {factoryAutoRunItem && !showProjectList && (
            <div className="mb-4 flex flex-wrap items-center justify-center gap-2 rounded-xl border-2 border-[#305931]/40 bg-[#305931]/15 p-4">
              <Factory className="h-5 w-5 text-[#305931]" />
              <span className="font-semibold text-[#29241b]">?�동??모드 ?�동 ?�성:</span>
              <span className="text-[#305931]">{factoryAutoRunItem.productName}</span>
              <span className="text-sm text-[#49554b]">
                · ?�료 ?�계?�서 ?�공???�약 ?�료?��? ?�르�??�동??모드 목록???�?�됩?�다.
              </span>
            </div>
          )}

        {/* ?�약 발행 목록: ?�동??모드 비활??*/}
        {false && showProjectList && showFactoryView && (
          <Card className="mb-6 border-[#305931]/25 bg-[#305931]/[0.06]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-[#305931]" />
                ?�약 발행 목록
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                지?�한 ?�짜???�상???�운로드?????�습?�다. ?�료 ?�계?�서 ?�예??발행?�으�??�록?�세??
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {scheduledItems.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[rgba(41,36,27,0.14)] py-4 text-center text-sm text-muted-foreground">
                  ?�약???�상???�습?�다. ?�상 ?�작 ??<strong>?�료</strong> ?�계?�서 ?�예??발행??버튼???�러 ?�록?�세??
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
                              ?�운로드
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

        {/* Cute paw pipeline */}
        {!showProjectList && (
          <div className="mb-6 md:mb-8">
            <div className="rounded-[32px] border border-[rgba(34,28,22,0.12)] bg-[#e1f6f0]/90 p-3 shadow-2xl shadow-black/25 md:p-4">
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="animal-bubble-chip px-3 py-1 text-[10px]">?�� CUTE STEPS</p>
                <p className="text-[11px] font-semibold text-[#3d4f47]">발자�?�� ?�라가 볼까??</p>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
                {[
                  { step: "product", label: "캐릭?�·제??, emoji: "?��" },
                  { step: "script", label: "?�본·TTS", emoji: "?��" },
                  { step: "video", label: "?��?지", emoji: "?���? },
                  { step: "render", label: "?�상", emoji: "?��" },
                  { step: "thumbnail", label: "?�네??, emoji: "?? },
                  { step: "preview", label: "?�집·?�료", emoji: "?�️" },
                ].map((item, index) => {
                  const isActive = activeStep === item.step
                  const isCompleted =
                    (activeStep === "script" && index < 1) ||
                    (activeStep === "video" && index < 2) ||
                    (activeStep === "render" && index < 3) ||
                    (activeStep === "thumbnail" && index < 4) ||
                    (activeStep === "preview" && index < 5)

                  return (
                    <button
                      key={item.step}
                      type="button"
                      className={`group relative flex min-h-[92px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[22px] border px-2 py-3 text-center transition-all duration-300 ${
                        isActive
                          ? "border-[#1d4594]/50 bg-[#85b6ff]/15 shadow-lg shadow-[#ff8fab]/20"
                          : isCompleted
                            ? "border-[#005835]/35 bg-[#7dd3a8]/12"
                            : "border-[rgba(34,28,22,0.08)] bg-black/20 hover:border-[#005835]/3 hover:bg-white/[0.04]"
                      }`}
                      onClick={() => {
                        const step = item.step as
                          | "product"
                          | "script"
                          | "video"
                          | "render"
                          | "thumbnail"
                          | "preview"
                        setActiveStep(step)
                      }}
                    >
                      <span
                        className={`flex h-11 w-11 items-center justify-center rounded-full border text-lg transition-all ${
                          isActive
                            ? "animal-paw-active border-[#1d4594]/45 bg-[#85b6ff] text-[#181818]"
                            : isCompleted
                              ? "border-[#005835]/40 bg-[#7dd3a8]/20"
                              : "border-[rgba(34,28,22,0.12)] bg-white/[0.04]"
                        }`}
                      >
                        {isCompleted && !isActive ? (
                          <CheckCircle2 className="h-5 w-5 text-[#005835]" />
                        ) : (
                          <span>{item.emoji}</span>
                        )}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={`text-[9px] font-extrabold tracking-[0.12em] ${
                            isActive
                              ? "text-[#1d4594]"
                              : isCompleted
                                ? "text-[#005835]"
                                : "text-[#697f75]"
                          }`}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </p>
                        <p
                          className={`animal-display mt-0.5 line-clamp-2 text-[11px] font-semibold leading-tight ${
                            isActive
                              ? "text-[#221c16]"
                              : isCompleted
                                ? "text-[#1c2520]"
                                : "text-[#3d4f47]"
                          }`}
                        >
                          {item.label}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* 메인 컨텐�?*/}
        {showProjectList ? (
          <div className="space-y-6">
            {/* ?�로?�트 목록 */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="animal-display text-lg font-bold text-[#221c16]">?�로?�트 목록</p>
                <p className="mt-1 text-sm text-[#3d4f47]">?�핑 ?�폼 ?�로?�트�?관리하?�요</p>
              </div>
              <Button
                onClick={() => {
                  setShowCreateProjectDialog(true)
                  setNewProjectName("")
                  setNewProjectDescription("")
                }}
                className="bg-[#c45c3e] font-semibold text-[#181818] shadow-lg shadow-[#c45c3e]/30 hover:bg-[#b04f34]"
              >
                <Plus className="w-4 h-4 mr-2" />
                ??촬영 ?�작
              </Button>
            </div>

            {/* ?�동??모드 UI 진입???�거 ???�로?�트 목록�??�시 */}
            {true ? (
            <>
            {/* ?�로?�트 검??*/}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 z-10" />
              <Input
                placeholder="?�로?�트 검??.."
                value={projectSearchQuery}
                onChange={(e) => setProjectSearchQuery(e.target.value)}
                className="h-12 border-[rgba(41,36,27,0.12)] bg-[#f7fffc]/90 pl-12 text-[#29241b] shadow-xl shadow-black/20 placeholder:text-[#7d8c80] focus:border-[#305931] focus:ring-[#305931]/20"
              />
            </div>

            {/* ?�로?�트 목록 */}
            {isLoadingProjects ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#305931]" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {projects
                  .filter((project) =>
                    project.name.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                    project.description?.toLowerCase().includes(projectSearchQuery.toLowerCase())
                  )
                  .map((project, index) => {
                    // 가??최근???�?�한 ?�로?�트 ?�나�?'최근' ?�그 ?�시 (?�렬??목록??�?번째)
                    const isRecent = index === 0
                    
                    return (
                    <Card 
                      key={project.id} 
                      className={`${isRecent ? "border-2 border-[#aa4426]" : "border border-[rgba(41,36,27,0.12)]"} group relative overflow-hidden transition-all duration-300 hover:border-[#305931]/45 hover:shadow-[0_20px_50px_rgba(20,35,70,0.122)]`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-[#305931]/[0.06] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                      {isRecent && (
                        <div className="absolute top-1 right-2 z-20">
                          <span className="rounded-full border border-[#aa4426]/40 bg-[#c45c3e] px-2 py-1 text-xs font-bold text-[#181818] shadow-lg">
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
                                        alert("?�로?�트 ?�름 변경에 ?�패?�습?�다.")
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
                            <span className="text-slate-500">?�성</span>
                            <span className="text-slate-600 font-medium">{new Date(project.created_at).toLocaleDateString("ko-KR")}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">?�정</span>
                            <span className="text-slate-600 font-medium">{new Date(project.updated_at).toLocaleDateString("ko-KR")}</span>
                          </div>
                          <Button
                            onClick={() => loadProject(project.id)}
                            className="animal-cta-cute mt-4 w-full rounded-full font-semibold"
                          >
                            <PawPrint className="w-4 h-4 mr-2" />
                            촬영???�기
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    )
                  })}
              </div>
            )}

            {projects.length === 0 && !isLoadingProjects && (
              <div className="py-16 text-center">
                <div className="relative mb-6 inline-block">
                  <div className="absolute inset-0 rounded-full bg-[#305931]/20 blur-2xl" />
                  <div className="relative rounded-full border border-[#305931]/30 bg-[#305931]/10 p-6 shadow-lg">
                    <PawPrint className="h-16 w-16 text-[#305931]" />
                  </div>
                </div>
                <p className="mb-6 text-lg text-[#49554b]">?�직 촬영???�어?? 귀?�운 친구�?불러볼까??</p>
                <Button
                  onClick={() => {
                    setShowCreateProjectDialog(true)
                    setNewProjectName("")
                    setNewProjectDescription("")
                  }}
                  className="animal-cta-cute rounded-full px-8 py-6 text-lg font-semibold"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  ??촬영 ?�작
                </Button>
              </div>
            )}

            {/* ???�로?�트 ?�성 ?�이?�로�?*/}
            <Dialog open={showCreateProjectDialog} onOpenChange={setShowCreateProjectDialog}>
              <DialogContent className="border-[rgba(41,36,27,0.12)] bg-[#f7fffc] shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-2xl font-bold text-[#29241b]">
                    <div className="rounded-xl border border-[#305931]/30 bg-[#305931]/15 p-2 shadow-sm">
                      <PawPrint className="h-5 w-5 text-[#305931]" />
                    </div>
                    ??촬영 ?�작
                  </DialogTitle>
                  <DialogDescription className="text-[#49554b]">
                    ?�로?�트 ?�름�??�명???�력??캐릭???�튜?�오 촬영???�작?�세??
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-5 py-4">
                  <div className="space-y-2">
                    <Label className="font-semibold text-[#2d342e]">?�로?�트 ?�름</Label>
                    <Input
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="?�로?�트 ?�름???�력?�세??
                      className="border-[rgba(41,36,27,0.12)] bg-black/35 text-[#29241b] placeholder:text-[#657468] focus:border-[#305931]/70 focus:ring-[#305931]/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-semibold text-[#2d342e]">?�명 (?�택?�항)</Label>
                    <Textarea
                      value={newProjectDescription}
                      onChange={(e) => setNewProjectDescription(e.target.value)}
                      placeholder="?�로?�트 ?�명???�력?�세??
                      rows={3}
                      className="resize-none border-[rgba(41,36,27,0.12)] bg-black/35 text-[#29241b] placeholder:text-[#657468] focus:border-[#305931]/70 focus:ring-[#305931]/20"
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
                    className="border-[rgba(41,36,27,0.14)] bg-white/[0.03] font-semibold text-[#49554b] hover:bg-white/[0.08] hover:text-[#29241b]"
                  >
                    취소
                  </Button>
                  <Button
                    onClick={() => {
                      if (newProjectName.trim()) {
                        saveProject(undefined, true) // ???�로?�트�??�성 (기존 ?�로?�트 ??��?�기)
                      } else {
                        alert("?�로?�트 ?�름???�력?�주?�요.")
                      }
                    }}
                    disabled={isSavingProject}
                    className="bg-[#c45c3e] font-semibold text-[#181818] shadow-lg shadow-[#c45c3e]/25 hover:bg-[#b04f34]"
                  >
                    {isSavingProject ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ?�성 �?..
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        ?�성
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            </>
            ) : (
            /* ?�동??모드 �? ?�리미엄 UI + ?�상 ?�동???�니메이??*/
            <>
              <style>{`
                @keyframes factoryConveyor { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
                @keyframes factoryGlow { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
                @keyframes factoryShine { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
                @keyframes factoryPulseRing { 0%, 100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.15); opacity: 0; } }
                @keyframes cardEnter { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes stepFlow { 0% { stroke-dashoffset: 24; } 100% { stroke-dashoffset: 0; } }
                @keyframes floatIcon { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
              `}</style>
              <div className="min-h-[60vh] space-y-8 animate-in fade-in duration-500">
                {/* ?�단 ?�더 */}
                <div className="rounded-2xl bg-gradient-to-br from-slate-800 via-slate-700 to-amber-900/40 p-6 text-white shadow-xl shadow-slate-900/30 border border-slate-600/50">
                  <p className="text-slate-200 text-base font-medium tracking-tight">
                    ?�짜·?�품·?��?지·목소리�? ?�해?�면 <span className="text-amber-300 font-semibold">?�당 ?�짜???�상???�동 ?�성</span>?�니??
                  </p>
                </div>
                {/* 컨베?�어 벨트: ?�상 ?�동???�이?�라??*/}
                {(() => {
                  const generatingItem = factorySchedules.find((s) => s.status === "generating")
                  const currentPhaseLabel = generatingItem?.phase ? getFactoryPhaseDisplayText(generatingItem.phase) : null
                return (
                <div className="relative overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-b from-amber-50/90 to-orange-50/80 p-5 shadow-lg shadow-amber-500/10">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-amber-200/20 to-transparent bg-[length:200%_100%] pointer-events-none" style={{ animation: "factoryShine 6s linear infinite" }} />
                  <div className="absolute inset-0 flex items-center pointer-events-none overflow-hidden rounded-2xl">
                    <div className="flex" style={{ width: "200%", animation: "factoryConveyor 25s linear infinite" }}>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <div key={i} className="flex items-center gap-3 shrink-0 px-6">
                          <div className="w-12 h-12 rounded-xl bg-amber-200/90 border border-amber-400/50 shadow-md flex items-center justify-center" style={{ animation: "floatIcon 2s ease-in-out infinite", animationDelay: `${i * 0.15}s` }}>
                            <ShoppingBag className="w-6 h-6 text-amber-700" />
                          </div>
                          <div className="w-1.5 h-8 rounded-full bg-amber-400/40" />
                          <div className="w-12 h-12 rounded-xl bg-sky-200/90 border border-sky-400/50 shadow-md flex items-center justify-center" style={{ animation: "floatIcon 2s ease-in-out infinite", animationDelay: `${i * 0.15 + 0.1}s` }}>
                            <FileText className="w-6 h-6 text-sky-700" />
                          </div>
                          <div className="w-1.5 h-8 rounded-full bg-sky-400/40" />
                          <div className="w-12 h-12 rounded-xl bg-violet-200/90 border border-violet-400/50 shadow-md flex items-center justify-center" style={{ animation: "floatIcon 2s ease-in-out infinite", animationDelay: `${i * 0.15 + 0.2}s` }}>
                            <ImageIcon className="w-6 h-6 text-violet-700" />
                          </div>
                          <div className="w-1.5 h-8 rounded-full bg-violet-400/40" />
                          <div className="w-12 h-12 rounded-xl bg-orange-200/90 border border-orange-400/50 shadow-md flex items-center justify-center" style={{ animation: "floatIcon 2s ease-in-out infinite", animationDelay: `${i * 0.15 + 0.3}s` }}>
                            <Video className="w-6 h-6 text-orange-700" />
                          </div>
                          <div className="w-1.5 h-8 rounded-full bg-orange-400/40" />
                          <div className="w-12 h-12 rounded-xl bg-emerald-200/90 border border-emerald-400/50 shadow-md flex items-center justify-center" style={{ animation: "floatIcon 2s ease-in-out infinite", animationDelay: `${i * 0.15 + 0.4}s` }}>
                            <CheckCircle2 className="w-6 h-6 text-emerald-700" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="relative flex items-center justify-center py-8">
                    <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl border-2 shadow-lg ${currentPhaseLabel ? "bg-gradient-to-r from-amber-100 to-orange-100 border-amber-400/70 shadow-amber-500/20" : "bg-white/95 border-amber-300/60 shadow-slate-200/50"}`}>
                      <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-amber-400/30 animate-ping" style={{ animationDuration: "2s" }} />
                        <Cog className="relative w-6 h-6 text-amber-600 animate-spin" style={{ animationDuration: "3s" }} />
                      </div>
                      <span className="font-semibold text-slate-800">
                        {currentPhaseLabel ? (
                          <>?�업 �?· {currentPhaseLabel}</>
                        ) : (
                          <>?�동???��?· ?�당 ?�짜???�동 ?�성</>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                )})()}
                {/* ?�약 ?�력 */}
                <div className="rounded-2xl border border-slate-200/80 bg-white/98 p-4 md:p-5 shadow-md shadow-slate-200/50 backdrop-blur-sm" style={{ animation: "cardEnter 0.5s ease-out both", animationDelay: "100ms" }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-amber-900 flex items-center gap-2">
                    <CalendarClock className="w-5 h-5 text-amber-600" />
                    ?�약 ?�력
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
                  const weekDays = ["??, "??, "??, "??, "�?, "�?, "??]
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
                      ? `${dateStr}: ${itemsWithTime.length ? itemsWithTime.join(" · ") : "?�약 " + count + "�?}`
                      : undefined
                    return (
                      <div
                        key={dateStr}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setNewFactoryDate(dateStr)
                          setShowAddFactoryScheduleDialog(true)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            setNewFactoryDate(dateStr)
                            setShowAddFactoryScheduleDialog(true)
                          }
                        }}
                        className={`min-h-[3.5rem] flex flex-col items-center justify-start rounded-lg text-sm transition-all py-1 px-0.5 cursor-pointer hover:bg-amber-50 hover:ring-2 hover:ring-amber-300/50 ${
                          hasSchedule
                            ? "bg-amber-100 text-amber-800 font-semibold ring-2 ring-amber-400/60"
                            : "text-slate-600"
                        } ${isToday ? "ring-2 ring-orange-400 ring-offset-2" : ""}`}
                        title={titleText ? `${titleText}\n?�릭?�면 ???�짜�??�약 추�?` : "?�릭?�면 ???�짜�??�약 추�?"}
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
                                <span className="text-[9px] text-amber-600">??{count - 1}�?/span>
                              </>
                            )}
                          </div>
                        )}
                        {hasSchedule && productNames.length === 0 && count > 0 && (
                          <span className="text-[10px] text-amber-600 mt-0.5">?�약 {count}�?/span>
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
                  ?�약???�는 ?�에 ?�약???�상(?�품�????�시?�니?? ?�짜�??�릭?�면 ?�당 ?�짜�??�약 추�??????�습?�다.
                </p>
              </div>
              {/* ?�동??모드 6?�계 ?�로?�스 ?�테??*/}
              {(() => {
                const generatingItem = factoryPipelineRunningItemId
                  ? factorySchedules.find((s) => s.id === factoryPipelineRunningItemId)
                  : factorySchedules.find((s) => s.status === "generating")
                const currentStepIndex = generatingItem ? getFactoryPhaseStepIndex(generatingItem.phase) : -1
                const steps = [
                  { step: "product", label: "?�품 ?�력", icon: ShoppingBag },
                  { step: "script", label: "?��?�?TTS", icon: FileText },
                  { step: "video", label: "?��?지 ?�성", icon: ImageIcon },
                  { step: "render", label: "?�상 ?�성", icon: Video },
                  { step: "thumbnail", label: "?�네??, icon: ImageIcon },
                  { step: "preview", label: "?�료", icon: CheckCircle2 },
                ] as const
                if (currentStepIndex < 0) return null
                return (
                  <div className="rounded-2xl border border-[rgba(41,36,27,0.12)] bg-[#f7fffc]/95 p-5 shadow-2xl shadow-black/30 backdrop-blur-sm md:p-6" style={{ animation: "cardEnter 0.5s ease-out both", animationDelay: "200ms" }}>
                    <p className="mb-5 text-center text-sm font-semibold text-[#2d342e]">
                      {generatingItem?.productName ? (
                        <span className="text-[#305931]">진행 �? {generatingItem.productName}</span>
                      ) : (
                        "?�동 ?�성 진행 �?
                      )}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-1 md:gap-2">
                      {steps.map((item, index) => {
                        const Icon = item.icon
                        const isActive = currentStepIndex === index
                        const isCompleted = currentStepIndex > index
                        return (
                          <div key={item.step} className="flex items-center" style={{ animation: "cardEnter 0.5s ease-out both", animationDelay: `${250 + index * 50}ms` }}>
                            <div className="relative flex flex-col items-center">
                              {isActive && (
                                <div className="absolute inset-0 animate-pulse rounded-full bg-[#c45c3e]/25 blur-xl" style={{ animationDuration: "1.5s" }} />
                              )}
                              {isCompleted && (
                                <div className="absolute inset-0 rounded-full bg-[#305931]/20 blur-lg" />
                              )}
                              <div
                                className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-500 md:h-12 md:w-12 ${
                                  isActive
                                    ? "scale-110 bg-[#c45c3e] text-[#181818] shadow-lg shadow-[#c45c3e]/40 ring-2 ring-[#aa4426]/40"
                                    : isCompleted
                                      ? "scale-105 border border-[#305931]/35 bg-[#305931]/15 text-[#305931] shadow-md"
                                      : "border border-[rgba(41,36,27,0.1)] bg-white/[0.04] text-[#657468]"
                                }`}
                              >
                                <Icon className={`h-5 w-5 md:h-6 md:w-6 ${isActive ? "animate-bounce" : ""}`} style={isActive ? { animationDuration: "1s" } : undefined} />
                                {isCompleted && (
                                  <div className="absolute inset-0 flex items-center justify-center rounded-xl">
                                    <CheckCircle2 className="h-6 w-6 text-[#305931] md:h-7 md:w-7" />
                                  </div>
                                )}
                              </div>
                              <span
                                className={`mt-2 max-w-[3.5rem] text-center text-xs font-medium md:max-w-[4rem] md:text-sm ${
                                  isActive ? "text-[#aa4426]" : isCompleted ? "text-[#305931]" : "text-[#49554b]"
                                }`}
                              >
                                {item.label}
                              </span>
                              {isActive && (
                                <div className="relative mt-1.5 h-1 w-full animate-pulse rounded-full bg-gradient-to-r from-[#c45c3e] to-[#305931]" style={{ animationDuration: "1.2s" }} />
                              )}
                            </div>
                            {index < steps.length - 1 && (
                              <div className="mx-0.5 h-0.5 w-3 border-t-2 border-dashed border-[rgba(41,36,27,0.14)] md:w-6" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
              {/* ?�약 목록 (?�짜?? */}
              <div className="grid gap-4">
                {factorySchedules.length === 0 ? (
                  <div className="text-center py-14 rounded-2xl border-2 border-dashed border-slate-200 bg-gradient-to-b from-slate-50 to-white animate-in fade-in duration-500">
                    <Factory className="w-14 h-14 mx-auto text-slate-400 mb-4 opacity-80" />
                    <p className="text-slate-600 font-semibold">?�약???�습?�다</p>
                    <p className="text-sm text-slate-500 mt-1.5">?�예??추�??�로 ?�짜·?�품·?��?지·목소리�? ?�해?�세??</p>
                  </div>
                ) : (
                  factorySchedules
                    .slice()
                    .sort((a, b) => {
                      const at = `${a.scheduledDate}T${a.scheduledTime || "00:00"}`
                      const bt = `${b.scheduledDate}T${b.scheduledTime || "00:00"}`
                      return at.localeCompare(bt)
                    })
                    .map((item, idx) => {
                      const scheduledAt = `${item.scheduledDate}T${item.scheduledTime || "00:00"}`
                      const isDue = scheduledAt <= new Date().toISOString().slice(0, 16)
                      const isGenerating = item.status === "generating"
                      const isReady = item.status === "ready"
                      return (
                        <Card key={item.id} className="overflow-hidden border border-slate-200/80 bg-white/95 shadow-md shadow-slate-200/30 hover:shadow-lg hover:border-amber-200/60 transition-all duration-300" style={{ animation: "cardEnter 0.45s ease-out both", animationDelay: `${300 + idx * 40}ms` }}>
                          <CardContent className="relative p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="absolute top-2 left-2 z-20 h-8 w-8 rounded-full border border-slate-200/90 bg-white/95 text-red-500 hover:text-red-600 hover:bg-red-50 shadow-sm"
                              title="?�약 ??��"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (!confirm(`"${item.productName}" ?�약????��?�까??`)) return
                                persistFactorySchedules(factorySchedules.filter((s) => s.id !== item.id))
                                if (item.videoBlobId) deleteShotFormScheduleVideoBlob(item.videoBlobId).catch(() => {})
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            <div
                              role="button"
                              tabIndex={0}
                              className="flex flex-1 min-w-0 items-start sm:items-center gap-4 cursor-pointer rounded-lg hover:bg-amber-50/80 transition-colors p-2 -m-2 pl-10 sm:pl-10"
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
                                    ?�업 �?· {getFactoryPhaseDisplayText(item.phase)}
                                  </p>
                                )}
                                {item.status === "generating" && factoryPipelineQueue.some((q) => q.id === item.id) && item.id !== factoryPipelineRunningItemId && (
                                  <p className="text-sm font-medium text-slate-500 mt-1">
                                    ?�기중
                                  </p>
                                )}
                                <p className="text-sm text-slate-500 mt-0.5">
                                  발행: {new Date(item.scheduledDate + "T" + (item.scheduledTime || "00:00")).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })} {item.scheduledTime || "00:00"}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">목소�? {item.voiceId.replace("ttsmaker-", "").replace("supertone-", "?�퍼??").replace("elevenlabs-", "ElevenLabs ")}</p>
                                <p className="text-xs text-amber-600 mt-1">?�릭?�면 ?�동 ?�집</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isReady && item.youtubeUploaded && (
                                <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                                  ?�튜�??�로???�료
                                </span>
                              )}
                              {isReady && !item.youtubeUploaded && youtubeChannelName && (
                                <>
                                  <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                                    ?�튜�?미업로드
                                  </span>
                                  <Button
                                    size="sm"
                                    className="bg-[#ff0000] hover:bg-[#cc0000] text-[#181818]"
                                    disabled={uploadingFactoryId === item.id}
                                    onClick={async () => {
                                      const blob = await getShotFormScheduleVideoBlob(item.videoBlobId || item.id)
                                      if (!blob) {
                                        alert("?�?�된 ?�상??찾을 ???�습?�다. ?�당 ?�약???�릭???�시 ?�상???�성??주세??")
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
                                        const clientId = typeof window !== "undefined" ? localStorage.getItem("shopping_animal_factory_youtube_client_id") : null
                                        const clientSecret = typeof window !== "undefined" ? localStorage.getItem("shopping_animal_factory_youtube_client_secret") : null
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
                                          alert(data.message || "?�튜�??�약 ?�로?��? ?�료?�었?�니??")
                                        } else {
                                          alert(`?�튜�??�로???�패: ${data.error || res.statusText}`)
                                        }
                                      } catch (e) {
                                        alert(`?�로??�??�류: ${e instanceof Error ? e.message : "?????�음"}`)
                                      } finally {
                                        setUploadingFactoryId(null)
                                      }
                                    }}
                                  >
                                    {uploadingFactoryId === item.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                                    ?�튜브에 ?�로??                                  </Button>
                                </>
                              )}
                              {isReady && !item.youtubeUploaded && !youtubeChannelName && (
                                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                  ?�약 ?�료
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
                                  {isGenerating ? "?�성 �?.." : "?�상 ?�성"}
                                </Button>
                              )}
                              {item.status === "failed" && (
                                <span className="text-xs text-red-600" title={item.errorMessage || ""}>
                                  ?�패{item.errorMessage ? `: ${item.errorMessage}` : ""}
                                </span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })
                )}
              </div>
            </div>
            </>
            )}
            {/* ?�동??모드 비�?번호 ?�력 (?�자 마스?? */}
            <Dialog open={showFactoryPasswordDialog} onOpenChange={(open) => { setShowFactoryPasswordDialog(open); if (!open) setFactoryPasswordInput("") }}>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    ?�동??모드
                    <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">?�스??/span>
                  </DialogTitle>
                  <DialogDescription>비�?번호�??�력?�세??</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="factory-pw" className="text-sm text-slate-600">비�?번호</Label>
                    <Input
                      id="factory-pw"
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="비�?번호"
                      value={factoryPasswordInput}
                      onChange={(e) => setFactoryPasswordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (factoryPasswordInput === "111") {
                            setShowFactoryView(true)
                            setShowFactoryPasswordDialog(false)
                            setFactoryPasswordInput("")
                          } else {
                            alert("비�?번호가 ?�바르�? ?�습?�다.")
                          }
                        }
                      }}
                      className="font-mono"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => { setShowFactoryPasswordDialog(false); setFactoryPasswordInput("") }}>취소</Button>
                    <Button
                      className="bg-amber-600 hover:bg-amber-700"
                      onClick={() => {
                        if (factoryPasswordInput === "111") {
                          setShowFactoryView(true)
                          setShowFactoryPasswordDialog(false)
                          setFactoryPasswordInput("")
                        } else {
                          alert("비�?번호가 ?�바르�? ?�습?�다.")
                        }
                      }}
                    >
                      ?�인
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            {/* ?�동??모드 ?�정 ?�이?�로�?(?�튜�??�동) */}
            <Dialog open={showFactorySettingsDialog} onOpenChange={setShowFactorySettingsDialog}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>?�동??모드 ?�정</DialogTitle>
                  <DialogDescription>
                    ?�약 발행 ???�튜�??�츠 ?�동 ?�로?��? ?�해 채널???�동?????�습?�다.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label className="text-amber-900 font-medium">YouTube API ?�정</Label>
                    <p className="text-sm text-slate-600">Google Cloud Console?�서 OAuth 2.0 ?�라?�언??ID(???�플리�??�션)�?만든 ???�래???�력?�세??</p>
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
                              localStorage.setItem("shopping_animal_factory_youtube_client_id", youtubeClientId.trim())
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
                              localStorage.setItem("shopping_animal_factory_youtube_client_secret", youtubeClientSecret)
                          } catch (_) {}
                        }}
                        className="font-mono text-sm"
                      />
                    </div>
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1">
                      <strong>redirect_uri_mismatch ?�류 ??</strong> Google Cloud Console ???�용???�증 ?�보 ???�당 OAuth ?�라?�언????&quot;?�인??리디?�션 URI&quot;???�래 주소�?<strong>그�?�?/strong> 추�??�세??
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-slate-100 px-2 py-1 rounded break-all flex-1">
                        {typeof window !== "undefined" ? `${window.location.origin}/api/youtube/callback` : "https://?�메??api/youtube/callback"}
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
                            alert("리디?�션 URI가 ?�립보드??복사?�었?�니??")
                          }
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-amber-900 font-medium">YouTube ?�동</Label>
                    {youtubeChannelName ? (
                      <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
                        <p className="text-sm text-amber-800">
                          ?�결??채널: <span className="font-semibold">{youtubeChannelName}</span>
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-amber-300 text-amber-700 hover:bg-amber-100"
                          onClick={() => {
                            const key = "shopping_animal_factory_youtube_channel"
                            try {
                              if (typeof window !== "undefined") localStorage.removeItem(key)
                            } catch (_) {}
                            setYoutubeChannelName(null)
                            setShowFactorySettingsDialog(false)
                          }}
                        >
                          ?�동 ?�제
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <p className="text-sm text-slate-600">YouTube 채널�??�동?�면 ?�약 발행 ???�당 채널???�동 ?�로?�할 ???�습?�다.</p>
                        <Button
                          type="button"
                          className="bg-[#ff0000] hover:bg-[#cc0000] text-[#181818]"
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
                                  alert(data.error || "?�동 ?�작???�패?�습?�다.")
                                  return
                                }
                              } catch (e) {
                                alert("?�동 ?�청 �??�류가 발생?�습?�다.")
                                return
                              }
                            }
                            window.location.href = "/api/youtube/auth?state=shopping_factory"
                          }}
                        >
                          YouTube 채널�??�동
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            {/* ?�동??모드 - ?�약 추�? ?�이?�로�?(공장 ??��?�도 ?�리?�록 showProjectList??????�� ?�더) */}
            <Dialog open={showAddFactoryScheduleDialog} onOpenChange={setShowAddFactoryScheduleDialog}>
              <DialogContent className="sm:max-w-lg rounded-2xl border-slate-200/80 shadow-xl shadow-slate-200/50 overflow-hidden p-0 gap-0">
                <div className="bg-gradient-to-br from-amber-50 via-white to-orange-50/30 px-6 pt-6 pb-5 border-b border-amber-100/80">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                        <CalendarPlus className="w-5 h-5" />
                      </span>
                      ?�약 추�?
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 text-sm mt-1.5">
                      발행?�·상???�보�??�력?�면 ?�당 ?�짜???�상???�동 ?�성?�니??
                    </DialogDescription>
                  </DialogHeader>
                </div>
                <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-700/90">?�짜 · ?�간</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-slate-700">발행??/Label>
                        <Input type="date" value={newFactoryDate} onChange={(e) => setNewFactoryDate(e.target.value)} className="rounded-xl border-slate-200 bg-white" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-slate-700">발행 ?�간</Label>
                        <Input type="time" value={newFactoryTime} onChange={(e) => setNewFactoryTime(e.target.value)} className="rounded-xl border-slate-200 bg-white" />
                      </div>
                    </div>
                  </div>
                  <div className="h-px bg-gradient-to-r from-transparent via-amber-200/60 to-transparent" />
                  <div className="space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-700/90">?�품 ?�보</p>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700">?�품�?/Label>
                      <Input placeholder="?�품명을 ?�력?�세?? value={newFactoryName} onChange={(e) => setNewFactoryName(e.target.value)} className="rounded-xl border-slate-200 bg-white placeholder:text-slate-400" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700">?�품 ?�명 <span className="font-normal text-slate-400">(?�택)</span></Label>
                      <Textarea placeholder="?�품???�??간단???�명" value={newFactoryDesc} onChange={(e) => setNewFactoryDesc(e.target.value)} rows={2} className="resize-none rounded-xl border-slate-200 bg-white placeholder:text-slate-400" />
                    </div>
                  </div>
                  <div className="h-px bg-gradient-to-r from-transparent via-amber-200/60 to-transparent" />
                  <div className="space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-700/90">미디??· 목소�?/p>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700">?�품 ?��?지</Label>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <Input
                            type="file"
                            accept="image/*"
                            className="rounded-xl border-slate-200 bg-white file:mr-3 file:rounded-lg file:border-0 file:bg-amber-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-amber-700"
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
                        </div>
                        {newFactoryImage && (
                          <div className="relative shrink-0">
                            <img src={newFactoryImage} alt="" className="w-16 h-16 object-cover rounded-xl border-2 border-amber-200/80 shadow-sm" />
                            <Button type="button" variant="ghost" size="icon" onClick={() => setNewFactoryImage(null)} className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-slate-700 text-[#181818] hover:bg-red-500 shadow-md">
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700">목소�?/Label>
                      <Select value={newFactoryVoiceId} onValueChange={setNewFactoryVoiceId}>
                        <SelectTrigger className="rounded-xl border-slate-200 bg-white">
                          <SelectValue placeholder="목소�??�택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="elevenlabs-jB1Cifc2UQbq1gR3wnb0">ElevenLabs Rachel</SelectItem>
                          <SelectItem value="elevenlabs-8jHHF8rMqMlg8if2mOUe">ElevenLabs Voice 2</SelectItem>
                          <SelectItem value="elevenlabs-uyVNoMrnUku1dZyVEXwD">ElevenLabs Voice 3</SelectItem>
                          <SelectItem value="elevenlabs-1KNqBv4TutQtzSIACsMC">ElevenLabs Voice 4</SelectItem>
                          <SelectItem value="elevenlabs-4JJwo477JUAx3HV0T7n7">ElevenLabs Voice 5</SelectItem>
                          <SelectItem value="supertonic-F1">Supertonic F1</SelectItem>
                          <SelectItem value="supertonic-M1">Supertonic M1</SelectItem>
                          {supertoneVoices.map((v) => (
                            <SelectItem key={v.voice_id} value={`supertone-${v.voice_id}`}>
                              ?�퍼??{v.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {supertoneVoices.length === 0 && (
                        <p className="text-xs text-slate-400">?�퍼??목록?� ?��??�계 AI ?�성?�서 불러?????�어??</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-200/80 flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setShowAddFactoryScheduleDialog(false)} className="rounded-xl border-slate-200 text-slate-600 hover:bg-white">
                    취소
                  </Button>
                  <Button
                    onClick={() => {
                      if (!newFactoryDate || !newFactoryName.trim()) {
                        alert("발행?�과 ?�품명을 ?�력?�주?�요.")
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
                      setNewFactoryVoiceId("ttsmaker-?�성1")
                      setFactoryPipelineQueue((prev) => [...prev, newItem])
                    }}
                    className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium shadow-md shadow-amber-500/25 px-6"
                  >
                    ?�약 추�?
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="animal-step-surface">{renderStepContent()}</div>
        )}
        
        {/* ?�겨�?Canvas (?�더링용) */}
        <canvas
          ref={canvasRef}
          width={1080}
          height={1920}
          className="hidden"
          style={{ width: "1080px", height: "1920px" }}
        />
      </div>

      {/* ?�이�??�기 ?�워???�이?�로�?*/}
      <Dialog open={showKeywordsDialog} onOpenChange={setShowKeywordsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] bg-white/95 backdrop-blur-xl border-2 border-orange-200/50 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-orange-500" />
              ?�재 ?�뜨???�워??            </DialogTitle>
            <DialogDescription className="text-slate-600">
              ?�이�??�이?�랩?�서 최근 7?�간 ?�기 검???�워?��? 가?�왔?�니?? ?�워?��? ?�릭?�면 ?�품명에 ?�동?�로 ?�력?�니??
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
            {isLoadingKeywords ? (
              <div className="flex flex-col items-center justify-center py-16">
                {/* AI가 ?�워?��? 찾는 ?�니메이??*/}
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
                    AI가 ?�기 ?�워?��? 분석 �?..
                  </p>
                  <div className="flex items-center justify-center gap-1">
                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                    <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                  </div>
                  <p className="text-sm text-slate-500 mt-4">최신 ?�렌?��? 찾고 ?�어??/p>
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
                        ?�택
                      </button>
                      <a
                        href={`https://www.coupang.com/np/search?q=${encodeURIComponent(keyword)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 px-3 py-1.5 text-xs font-semibold bg-white border-2 border-orange-300 hover:border-orange-400 text-orange-600 hover:text-orange-700 rounded-lg transition-all shadow-sm hover:shadow-md text-center"
                      >
                        쿠팡 검??                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-slate-500">?�기 ?�워?��? 불러?????�습?�다.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowKeywordsDialog(false)}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
            >
              ?�기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ?�스�?챗봇 */}
      {!isChatbotOpen && (
        <button
          onClick={() => {
            setIsChatbotOpen(true)
            if (chatbotMessages.length === 0) {
              setChatbotMessages([{
                type: "assistant",
                content: "?�녕?�세?? ?�스봇입?�다. 무엇???��??�릴까요?"
              }])
            }
          }}
          className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-50 group"
          title="?�스봇과 ?�?�하�?
        >
          <Bot className="w-8 h-8 group-hover:scale-110 transition-transform" />
        </button>
      )}

      {isChatbotOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-xl shadow-2xl border-2 border-gray-200 flex flex-col z-50">
          {/* 챗봇 ?�더 */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 rounded-t-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-6 h-6" />
              <h3 className="font-bold text-lg">?�스�?/h3>
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

          {/* 메시지 ?�역 */}
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
                    <span className="text-sm text-gray-500">?�답 ?�성 �?..</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ?�력 ?�역 */}
          <div className="p-4 border-t border-gray-200 bg-white rounded-b-xl">
            <div className="flex gap-2">
              <Textarea
                placeholder="메시지�??�력?�세??.."
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

      {/* ?�디???�이브러�??�이?�로�?- ??�� ?�더�?*/}
      {/* BGM ?�이브러�??�이?�로�?*/}
      <Dialog open={showBgmLibraryDialog} onOpenChange={(open) => {
        console.log("[Shopping] BGM ?�이?�로�?onOpenChange ?�출??", open, "?�재 ?�태:", showBgmLibraryDialog)
        // ?�버�? ??false�?변경되?��? ?�인
        if (!open && showBgmLibraryDialog) {
          console.log("[Shopping] ?�️ ?�이?�로그�? ?�려?�는???�기 ?�청???�어??")
          console.trace("[Shopping] ?�택 ?�레?�스:")
        }
        setShowBgmLibraryDialog(open)
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>BGM ?�이브러�?/DialogTitle>
            <DialogDescription>
              관리자가 ?�로?�한 BGM 중에???�택?�세??
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {isLoadingAudioLibrary ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                <span className="ml-2 text-sm text-slate-600">?�이브러�?로딩 �?..</span>
              </div>
            ) : bgmLibrary.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p>?�록??BGM???�습?�다.</p>
                <p className="text-xs mt-2">관리자?�게 문의?�세??</p>
                <p className="text-xs mt-1">로드??BGM 개수: {bgmLibrary.length}</p>
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
                    ?�택
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ?�과???�이브러�??�이?�로�?*/}
      <Dialog open={showSfxLibraryDialog} onOpenChange={(open) => {
        console.log("[Shopping] ?�과???�이?�로�?onOpenChange ?�출??", open, "?�재 ?�태:", showSfxLibraryDialog)
        // ?�버�? ??false�?변경되?��? ?�인
        if (!open && showSfxLibraryDialog) {
          console.log("[Shopping] ?�️ ?�이?�로그�? ?�려?�는???�기 ?�청???�어??")
          console.trace("[Shopping] ?�택 ?�레?�스:")
        }
        setShowSfxLibraryDialog(open)
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>?�과???�이브러�?/DialogTitle>
            <DialogDescription>
              관리자가 ?�로?�한 ?�과??중에???�택?�세??
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {isLoadingAudioLibrary ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-2 text-sm text-slate-600">?�이브러�?로딩 �?..</span>
              </div>
            ) : sfxLibrary.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p>?�록???�과?�이 ?�습?�다.</p>
                <p className="text-xs mt-2">관리자?�게 문의?�세??</p>
                <p className="text-xs mt-1">로드???�과??개수: {sfxLibrary.length}</p>
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
                    ?�택
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ?�약 발행 모달 (ShotForm ?�핑) */}
      <Dialog open={scheduleModalOpen} onOpenChange={setScheduleModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>?�약 발행</DialogTitle>
            <DialogDescription>
              ?�상??미리 ?�성???�고, ?�택???�짜·?�간???�면 ?�약 목록?�서 ?�운로드?????�습?�다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="schedule-date">발행 ?�짜</Label>
              <Input
                id="schedule-date"
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="schedule-time">발행 ?�간</Label>
              <Input
                id="schedule-time"
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </div>
            {productName && (
              <p className="text-sm text-muted-foreground">
                ?�품: <span className="font-medium text-foreground">{productName}</span>
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
                  ?�상 ?�성 �??�약 �?..
                </>
              ) : (
                <>
                  <CalendarClock className="w-4 h-4 mr-2" />
                  ?�약?�기
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}



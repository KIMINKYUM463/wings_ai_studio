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

// AudioBufferë¥?WAVë¡?ë³€?˜í•˜???¨ìˆ˜
const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
  const length = buffer.length
  const numberOfChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2)
  const view = new DataView(arrayBuffer)
  const channels: Float32Array[] = []
  let offset = 0
  let pos = 0

  // WAV ?¤ë” ?‘ì„±
  const setUint16 = (data: number) => {
    view.setUint16(pos, data, true)
    pos += 2
  }
  const setUint32 = (data: number) => {
    view.setUint32(pos, data, true)
    pos += 4
  }

  // RIFF ?¤ë”
  setUint32(0x46464952) // "RIFF"
  setUint32(length * numberOfChannels * 2 + 36) // ?Œì¼ ?¬ê¸° - 8
  setUint32(0x45564157) // "WAVE"

  // fmt ì²?¬
  setUint32(0x20746d66) // "fmt "
  setUint32(16) // ì²?¬ ?¬ê¸°
  setUint16(1) // ?¤ë””???¬ë§· (1 = PCM)
  setUint16(numberOfChannels) // ì±„ë„ ??  setUint32(sampleRate) // ?˜í”Œ?ˆì´??  setUint32(sampleRate * numberOfChannels * 2) // ë°”ì´???ˆì´??  setUint16(numberOfChannels * 2) // ë¸”ë¡ ?•ë ¬
  setUint16(16) // ë¹„íŠ¸ ê¹Šì´

  // data ì²?¬
  setUint32(0x61746164) // "data"
  setUint32(length * numberOfChannels * 2) // ?°ì´???¬ê¸°

  // ì±„ë„ ?°ì´??ê°€?¸ì˜¤ê¸?  for (let i = 0; i < numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i))
  }

  // PCM ?°ì´???‘ì„±
  // ê°??˜í”Œ???œíšŒ?˜ë©´??ëª¨ë“  ì±„ë„???°ì´?°ë? ?¸í„°ë¦¬ë¸Œ ?•ì‹?¼ë¡œ ?‘ì„±
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      let sample = Math.max(-1, Math.min(1, channels[channel][i]))
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(pos, sample, true)
      pos += 2
    }
  }

  console.log("[Shopping] WAV ë³€???„ë£Œ:", {
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

// ?ˆì•½ ë°œí–‰ (ShotForm ?¼í•‘ ?„ìš©)
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

// ?ë™??ëª¨ë“œ (ê³µì¥ ëª¨ë“œ): ? ì§œë³??í’ˆÂ·?´ë?ì§€Â·ëª©ì†Œë¦¬ë§Œ ?•í•´?ë©´ ?´ë‹¹ ? ì— ?ìƒ ?ë™ ?ì„±
const FACTORY_SCHEDULES_STORAGE_KEY = "wings_shotform_animal_shopping_factory_schedules"

export interface FactoryScheduleItem {
  id: string
  scheduledDate: string // YYYY-MM-DD
  scheduledTime?: string // HH:mm (ë°œí–‰ ?œÂ·ë¶„)
  productName: string
  productDescription?: string
  productImageBase64: string | null // ?¸ë„¤?¼ìš© ?‘ì? base64 ê°€??  voiceId: string // selectedVoiceId ?•ì‹ (ttsmaker-?¬ì„±1, supertone-xxx ??
  status: "pending" | "generating" | "ready" | "failed"
  phase?: string // ?¤í–‰ ?¨ê³„: product | script | video | render | thumbnail | preview
  createdAt: string
  errorMessage?: string
  videoBlobId?: string // ready????ShotForm schedule ID?€ ?™ì¼?˜ê²Œ ?¬ìš© ê°€??  projectId?: string // ?ë™??ëª¨ë“œ ?ë™ ?ì„± ???ì„±Â·?€?¥ë˜???„ë¡œ?íŠ¸ ID
  /** ?ˆì•½ ?„ë£Œ ??? íŠœë¸??…ë¡œ?œì— ?¬ìš© (?œëª©/?¤ëª…/?œê·¸ ?ì„±ê¸?ê°? */
  youtubeTitle?: string
  youtubeDescription?: string
  youtubeTags?: string[]
  /** ?ë™??ëª¨ë“œ?ì„œ ?ë™ ?…ë¡œ???„ë£Œ??ê²½ìš° true (ëª©ë¡?ì„œ ?¤ìš´ë¡œë“œ ë²„íŠ¼ ?€??? íŠœë¸??…ë¡œ???„ë£Œ ?œì‹œ) */
  youtubeUploaded?: boolean
}

const FACTORY_PHASE_LABELS: Record<string, string> = {
  product: "?œí’ˆ ?…ë ¥",
  script: "?€ë³¸Â·TTS ?ì„±",
  video: "?´ë?ì§€ ?ì„±",
  render: "?ìƒ ?ì„±",
  thumbnail: "?¸ë„¤???ì„±",
  preview: "ë¯¸ë¦¬ë³´ê¸°Â·?Œë”ë§?,
}

// ?ë™??ëª¨ë“œ ?¨ê³„ ?œì„œ ë°??¨ê³„ë³??´ë¦„ (?„ë£Œ/ì§„í–‰ ì¤??œì‹œ??
const FACTORY_PHASES_ORDER: Array<{ key: string; label: string }> = [
  { key: "script", label: "?€ë³¸ìƒ?? },
  { key: "video", label: "?´ë?ì§€?ì„±" },
  { key: "tts", label: "TTS?ì„±" },
  { key: "render", label: "?ìƒ?ì„±" },
  { key: "preview", label: "ë¯¸ë¦¬ë³´ê¸°" },
]

function getFactoryPhaseDisplayText(phase: string | undefined): string {
  if (!phase) return "ì§„í–‰ ì¤?
  const idx = FACTORY_PHASES_ORDER.findIndex((p) => p.key === phase)
  if (idx < 0) return FACTORY_PHASE_LABELS[phase] || phase
  const parts: string[] = []
  for (let i = 0; i < FACTORY_PHASES_ORDER.length; i++) {
    if (i < idx) parts.push(`${FACTORY_PHASES_ORDER[i].label} ?„ë£Œ`)
    else if (i === idx) parts.push(`${FACTORY_PHASES_ORDER[i].label} ì¤?)
    else break
  }
  return parts.join(" ??")
}

// ?ë§‰: ?¨ì–´ ì¤‘ê°„?ì„œ ?Šì? ?Šê³ , ê³µë°± ?¨ìœ„ë¡?ë¬¶ì–´????ì¤„ì”© ?œì‹œ (?? "?´ê±° ?˜ë‚˜ë¡??”ë¦¬ê°€" / "ì§„ì§œ ?¬ì›Œ?¸ìš”")
const SUBTITLE_MAX_CHARS_PER_LINE = 11

// "??ê±°ì˜ˆ?? ??"? ê±°?ˆìš”"ì²˜ëŸ¼ ?„ì–´?°ê¸°???´ë?/ë³´ì¡°?©ì–¸?????¨ìœ„ë¡?ë¬¶ìŒ (ì¤??˜ëˆ” ??"?? / "ê±°ì˜ˆ??ë¡??Šê¸°ì§€ ?Šë„ë¡?
function mergeKoreanEndingSpaces(text: string): string {
  return text
    .replace(/\s+(ê±°ì˜ˆ??ê±°ì•¼|ê²?ê°™ì•„|???ˆì–´|???ˆì£ |ê²ë‹ˆ???µë‹ˆ???´ìš”|?¼ìš”|?˜ì£ |? ê¹Œ??\b/g, (m) => m.trim())
    .replace(/\s+(ê±°ì˜ˆ??ê±°ì•¼)\s*$/g, (m) => m.trim())
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

// ?ë™??ëª¨ë“œ 6?¨ê³„ ?¤í…Œ?¼ìš©: phase ???¤í… ?¸ë±??(0=?œí’ˆ?…ë ¥, 1=?€ë³¸Â·TTS, 2=?´ë?ì§€, 3=?ìƒ, 4=?¸ë„¤?? 5=?„ë£Œ)
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
  const shoppingBrandLabel = "AI ?™ë¬¼ ?¼í•‘ ?í¼"
  const [animalCharacter, setAnimalCharacter] = useState<AnimalCharacter>(() => createDefaultAnimalCharacter())
  const [isGeneratingCharacterRef, setIsGeneratingCharacterRef] = useState(false)
  const [productName, setProductName] = useState("")
  const [productDescription, setProductDescription] = useState("")
  const [productImage, setProductImage] = useState<string | null>(null)
  const [productImageFile, setProductImageFile] = useState<File | null>(null)
  const [productImageAspectRatio, setProductImageAspectRatio] = useState<number | null>(null) // ?œí’ˆ ?´ë?ì§€ ë¹„ìœ¨ (width/height)
  const [coupangSearchQuery, setCoupangSearchQuery] = useState("")
  const [coupangProducts, setCoupangProducts] = useState<CoupangRankedProduct[]>([])
  const [selectedCoupangProduct, setSelectedCoupangProduct] = useState<CoupangRankedProduct | null>(null)
  const [isSearchingCoupang, setIsSearchingCoupang] = useState(false)
  const [coupangSearchError, setCoupangSearchError] = useState("")
  const [coupangUrl, setCoupangUrl] = useState("")
  const [script, setScript] = useState("")
  const [videoUrl, setVideoUrl] = useState<string>("")
  const [imageUrls, setImageUrls] = useState<string[]>([]) // 3ê°??¥ë©´ ?´ë?ì§€ URL ë°°ì—´
  const [convertedVideoUrls, setConvertedVideoUrls] = useState<Map<number, string>>(new Map()) // ê°??¥ë©´ë³„ë¡œ ë³€?˜ëœ ?ìƒ URL ?€??  const [imagePrompts, setImagePrompts] = useState<Array<{ type: string; prompt: string; description: string; scriptText: string }>>([]) // ?´ë?ì§€ ?„ë¡¬?„íŠ¸ ë°°ì—´
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false) // ?„ë¡¬?„íŠ¸ ?ì„± ì¤??¬ë?
  const [promptsGenerated, setPromptsGenerated] = useState(false) // ?„ë¡¬?„íŠ¸ ?ì„± ?„ë£Œ ?¬ë?
  const [videoPrompts, setVideoPrompts] = useState<Map<number, string>>(new Map()) // ê°??¥ë©´ë³??ìƒ ?„ë¡¬?„íŠ¸ ?€??(?¸ë±??-> ?„ë¡¬?„íŠ¸)
  const [isGeneratingVideoPrompts, setIsGeneratingVideoPrompts] = useState<Map<number, boolean>>(new Map()) // ê°??¥ë©´ë³??ìƒ ?„ë¡¬?„íŠ¸ ?ì„± ì¤??¬ë?
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [isConvertingToVideo, setIsConvertingToVideo] = useState<Map<number, boolean>>(new Map()) // ê°??¥ë©´ë³?ë³€??ì¤??¬ë?
  const [isRegeneratingImage, setIsRegeneratingImage] = useState<Map<number, boolean>>(new Map()) // ê°??´ë?ì§€ë³??¬ìƒ??ì¤??¬ë?
  const [customImagePrompts, setCustomImagePrompts] = useState<Map<number, string>>(new Map()) // ê°??´ë?ì§€ë³?ì¶”ê? ?„ë¡¬?„íŠ¸ (?œêµ­??
  const [isMergingVideos, setIsMergingVideos] = useState(false) // ?ìƒ ?©ì¹˜ê¸?ì¤??¬ë?
  const [activeStep, setActiveStep] = useState<"product" | "script" | "video" | "render" | "thumbnail" | "preview">("product")
  const [error, setError] = useState<string>("")
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number }>({ current: 0, total: 3 })
  
  // TTS ë°??ìƒ ?Œë”ë§?ê´€???íƒœ
  const [scenes, setScenes] = useState<string[]>([]) // 3ê°??¥ë©´ ?ìŠ¤??  const [scriptLines, setScriptLines] = useState<ScriptLine[]>([]) // ?ë§‰???¼ì¸
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string>("")
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false)
  const [ttsProgress, setTtsProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 })
  const [isRendering, setIsRendering] = useState(false)
  const [isServerDownloading, setIsServerDownloading] = useState(false) // ?œë²„ ?¤ìš´ë¡œë“œ(Cloud Run ?Œë”) ì¤?  /** ëª¨ë°”???¸ì•±?ì„œ ?ë™ ?¤ìš´ë¡œë“œê°€ ??????ë³´ì—¬ì¤?'?ìƒ ?€?? ë§í¬ (??•˜???€?? */
  const [serverDownloadLink, setServerDownloadLink] = useState<{ url: string; fileName: string } | null>(null)
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false) // ë¯¸ë¦¬ë³´ê¸° ?ì„± ì¤??íƒœ
  const [previewGenerated, setPreviewGenerated] = useState(false) // ë¯¸ë¦¬ë³´ê¸° ?ì„± ?„ë£Œ ?¬ë?
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("elevenlabs-jB1Cifc2UQbq1gR3wnb0")
  const [ttsSpeed, setTtsSpeed] = useState(1.05)
  const [customElevenLabsVoices, setCustomElevenLabsVoices] = useState<Array<{ id: string; name: string }>>([]) // ?¬ìš©??ì¶”ê? ?¼ë ˆë¸ë©??ëª©ì†Œë¦?  const [supertoneVoices, setSupertoneVoices] = useState<Array<{ voice_id: string; name: string; language: string[]; styles: string[]; thumbnail_image_url?: string }>>([]) // ?˜í¼???Œì„± ëª©ë¡
  const [isLoadingSupertoneVoices, setIsLoadingSupertoneVoices] = useState(false) // ?˜í¼???Œì„± ëª©ë¡ ë¡œë”© ì¤?  const [selectedSupertoneVoiceId, setSelectedSupertoneVoiceId] = useState<string>("") // ? íƒ???˜í¼???Œì„± ID
  const [selectedSupertoneStyle, setSelectedSupertoneStyle] = useState<string>("neutral") // ? íƒ???˜í¼???¤í???/ typecast emotion
  const [customElevenLabsVoiceId, setCustomElevenLabsVoiceId] = useState<string>("") // ?¬ìš©?ê? ?…ë ¥??ElevenLabs ?Œì„± ID
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null)
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null)
  const [previewVideoElements, setPreviewVideoElements] = useState<HTMLVideoElement[]>([]) // ë¯¸ë¦¬ë³´ê¸°??ë¹„ë””???˜ë¦¬ë¨¼íŠ¸
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null) // ë¯¸ë¦¬ë³´ê¸°???¤ë””??  const [previewBgmAudio, setPreviewBgmAudio] = useState<HTMLAudioElement | null>(null) // ë¯¸ë¦¬ë³´ê¸°??BGM ?¤ë””??  const [previewSfxAudio, setPreviewSfxAudio] = useState<HTMLAudioElement | null>(null) // ë¯¸ë¦¬ë³´ê¸°???¨ê³¼???¤ë””??  const [previewAnimationFrame, setPreviewAnimationFrame] = useState<number | null>(null) // ë¯¸ë¦¬ë³´ê¸° ? ë‹ˆë©”ì´???„ë ˆ??(?¬ìš© ???? ë¡±í¼ ë°©ì‹)
  const [previewThumbnailImage, setPreviewThumbnailImage] = useState<HTMLImageElement | null>(null) // ë¯¸ë¦¬ë³´ê¸°???¸ë„¤???´ë?ì§€
  const [currentSubtitle, setCurrentSubtitle] = useState<string>("") // ?„ì¬ ?ë§‰ (ë¡±í¼ ë°©ì‹)
  const previewVideoRef = useRef<HTMLVideoElement | null>(null) // ë¯¸ë¦¬ë³´ê¸°??ë¹„ë””??ref (ë¡±í¼ ë°©ì‹)
  const [currentVideoIndex, setCurrentVideoIndex] = useState<number>(-1) // ?„ì¬ ?¬ìƒ ì¤‘ì¸ ?ìƒ ?¸ë±??  const [previousVideoIndex, setPreviousVideoIndex] = useState<number>(-1) // ?´ì „ ?¬ìƒ ì¤‘ì¸ ?ìƒ ?¸ë±??  const [videoTransitionOpacity, setVideoTransitionOpacity] = useState<number>(1) // ?ìƒ ?„í™˜ ?¨ê³¼??opacity
  
  // Canvas ë°?ë¯¸ë¦¬ë³´ê¸° ê´€??  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const previewContainerRef = useRef<HTMLDivElement | null>(null)
  
  // ?¸ë„¤???ì„±ê¸?ê´€??  const [thumbnailUrl, setThumbnailUrl] = useState<string>("")
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false)
  const [thumbnailHookingText, setThumbnailHookingText] = useState<{ line1: string; line2: string }>({ line1: "", line2: "" })
  const thumbnailCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [draggingBgmHandle, setDraggingBgmHandle] = useState<"start" | "end" | null>(null) // BGM ?¸ë“¤ ?œë˜ê·?ì¤?
  // ?ˆì•½ ë°œí–‰ (ShotForm ?¼í•‘)
  const [scheduledItems, setScheduledItems] = useState<ShoppingScheduleItem[]>([])
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [scheduleDate, setScheduleDate] = useState("")
  const [scheduleTime, setScheduleTime] = useState("09:00")
  const [isScheduling, setIsScheduling] = useState(false)
  const [draggingSfxHandle, setDraggingSfxHandle] = useState<"start" | "end" | null>(null) // ?¨ê³¼???¸ë“¤ ?œë˜ê·?ì¤?  const timelineRef = useRef<HTMLDivElement | null>(null) // ?€?„ë¼???¬ìƒë°?ref
  const bgmTimelineRef = useRef<HTMLDivElement | null>(null) // BGM ?€?„ë¼??ref
  const sfxTimelineRef = useRef<HTMLDivElement | null>(null) // ?¨ê³¼???€?„ë¼??ref
  const [thumbnailMode, setThumbnailMode] = useState<"ai" | "manual">("ai") // AI ?ì„± ?ëŠ” ì§ì ‘ ?ì„±
  const [thumbnailImages, setThumbnailImages] = useState<Array<{ url: string; text: { line1: string; line2: string }; isCustom: boolean }>>([]) // ?¬ëŸ¬ ?¸ë„¤???€??  const [selectedThumbnailIndex, setSelectedThumbnailIndex] = useState<number>(-1) // ? íƒ???¸ë„¤???¸ë±??  const [customThumbnailImage, setCustomThumbnailImage] = useState<string>("") // ì§ì ‘ ?…ë¡œ?œí•œ ?´ë?ì§€
  const [customThumbnailText, setCustomThumbnailText] = useState<{ line1: string; line2: string }>({ line1: "", line2: "" }) // ì§ì ‘ ?ì„±???¸ë„¤?¼ì˜ ?ìŠ¤??  const [customThumbnailTextStyle, setCustomThumbnailTextStyle] = useState<{
    line1Color: string
    line2Color: string
    fontSize: number // ê¸€???¬ê¸° (48 ~ 200)
    position: number // 0.0 ~ 1.0 (0 = ?ë‹¨, 0.5 = ì¤‘ì•™, 1.0 = ?˜ë‹¨)
    strokeWidth: number // ?Œë‘ë¦??ê»˜
    strokeColor: string // ?Œë‘ë¦??‰ìƒ
    imageScale: number // ?´ë?ì§€ ?•ë?/ì¶•ì†Œ (0.5 ~ 2.0)
    textRotation: number // ?ìŠ¤???Œì „ ê°ë„ (???¨ìœ„, -180 ~ 180)
  }>({
    line1Color: "#FFFFFF", // ?°ìƒ‰
    line2Color: "#00FFCC", // ë¯¼íŠ¸??    fontSize: 100, // ê¸€???¬ê¸° (ê¸°ë³¸ 100px)
    position: 0.45, // ì¤‘ì•™ ?½ê°„ ??    strokeWidth: 4,
    strokeColor: "#000000", // ê²€?•ìƒ‰ ?Œë‘ë¦?    imageScale: 1.0, // ê¸°ë³¸ 100%
    textRotation: 0 // ê¸°ë³¸ ?Œì „ ?†ìŒ
  })

  // ?ˆë¡œ??ê¸°ëŠ¥ ê´€???íƒœ
  const [videoDuration, setVideoDuration] = useState<12 | 15 | 20 | 30>(12) // ?ìƒ ê¸¸ì´ ?µì…˜
  const [isEditingScript, setIsEditingScript] = useState(false) // ?€ë³??¸ì§‘ ëª¨ë“œ
  const [editedScript, setEditedScript] = useState("") // ?¸ì§‘???€ë³?  const [scriptParts, setScriptParts] = useState<Array<{ part: string; text: string; startIndex: number; endIndex: number }>>([]) // ?€ë³??ŒíŠ¸ ë¶„ì„ ê²°ê³¼
  const [isAnalyzingScript, setIsAnalyzingScript] = useState(false) // ?€ë³?ë¶„ì„ ì¤??¬ë?
  
  // ?ë§‰ ?¤í????¤ì •
  const [subtitleStyle, setSubtitleStyle] = useState<AnimalSubtitleStyle>({ ...DEFAULT_ANIMAL_SUBTITLE_STYLE })
  const [editInspectorTab, setEditInspectorTab] = useState<"subtitle" | "audio" | "meta">("subtitle")
  
  // BGM ê´€???íƒœ
  const [bgmUrl, setBgmUrl] = useState<string>("")
  const [bgmFile, setBgmFile] = useState<File | null>(null)
  const [bgmVolume, setBgmVolume] = useState(0.3) // BGM ë³¼ë¥¨ (0-1)
  const [bgmStartTime, setBgmStartTime] = useState(0) // BGM ?œì‘ ?œê°„ (ì´?
  const [bgmEndTime, setBgmEndTime] = useState(0) // BGM ì¢…ë£Œ ?œê°„ (ì´?
  const [ttsVolume, setTtsVolume] = useState(1.0) // TTS ë³¼ë¥¨ (0-1)
  
  // ?¨ê³¼??ê´€???íƒœ
  const [sfxUrl, setSfxUrl] = useState<string>("")
  const [sfxFile, setSfxFile] = useState<File | null>(null)
  const [sfxVolume, setSfxVolume] = useState(0.5) // ?¨ê³¼??ë³¼ë¥¨ (0-1)
  const [sfxStartTime, setSfxStartTime] = useState(0) // ?¨ê³¼???œì‘ ?œê°„ (ì´?
  const [sfxEndTime, setSfxEndTime] = useState(0) // ?¨ê³¼??ì¢…ë£Œ ?œê°„ (ì´?
  
  // ?¤ë””???¼ì´ë¸ŒëŸ¬ë¦?ê´€???íƒœ
  const [bgmLibrary, setBgmLibrary] = useState<AudioLibraryItem[]>([])
  const [sfxLibrary, setSfxLibrary] = useState<AudioLibraryItem[]>([])
  const [isLoadingAudioLibrary, setIsLoadingAudioLibrary] = useState(false)
  const [showBgmLibraryDialog, setShowBgmLibraryDialog] = useState(false)
  const [showSfxLibraryDialog, setShowSfxLibraryDialog] = useState(false)
  
  // ?ìƒ ?¨ê³¼ ë°??„í™˜
  const [transitionEffect, setTransitionEffect] = useState<"none" | "fade" | "slide" | "zoom">("fade")
  const [transitionDuration, setTransitionDuration] = useState(0.5) // ?„í™˜ ?œê°„ (ì´?
  
  // ?œëª©/?¤ëª…/?œê·¸ ?ë™ ?ì„±
  const [youtubeTitle, setYoutubeTitle] = useState("")
  const [youtubeDescription, setYoutubeDescription] = useState("")
  const [youtubeTags, setYoutubeTags] = useState<string[]>([])
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false)
  const [copiedTitle, setCopiedTitle] = useState(false)
  const [copiedDescription, setCopiedDescription] = useState(false)
  const [copiedTags, setCopiedTags] = useState(false)

  // ?„ë¡œ?íŠ¸ ê´€ë¦??íƒœ
  const [projects, setProjects] = useState<ShoppingProject[]>([])
  const [currentProject, setCurrentProject] = useState<ShoppingProject | null>(null)
  const [showProjectList, setShowProjectList] = useState(true) // ?„ë¡œ?íŠ¸ ëª©ë¡ ?”ë©´ ?œì‹œ ?¬ë?
  const [showFactoryView, setShowFactoryView] = useState(false) // ?ë™??ëª¨ë“œ UI ë¹„í™œ??(ì§„ì…???œê±°)
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
  /** ?ë™??ëª¨ë“œ ë°±ê·¸?¼ìš´???Œì´?„ë¼???€ê¸???(?œì°¨ ì²˜ë¦¬?? */
  const [factoryPipelineQueue, setFactoryPipelineQueue] = useState<FactoryScheduleItem[]>([])
  /** ?„ì¬ ?Œì´?„ë¼???¤í–‰ ì¤‘ì¸ ?ˆì•½ ID (ëª©ë¡?ì„œ '?‘ì—… ì¤? ?œì‹œ?? */
  const [factoryPipelineRunningItemId, setFactoryPipelineRunningItemId] = useState<string | null>(null)
  const factoryPipelineRunningRef = useRef(false)
  const [showFactorySettingsDialog, setShowFactorySettingsDialog] = useState(false)
  const [showFactoryPasswordDialog, setShowFactoryPasswordDialog] = useState(false)
  const [factoryPasswordInput, setFactoryPasswordInput] = useState("")
  const [uploadingFactoryId, setUploadingFactoryId] = useState<string | null>(null)
  const [youtubeChannelName, setYoutubeChannelName] = useState<string | null>(null) // ?°ë™??? íŠœë¸?ì±„ë„ëª?(?ë™??ëª¨ë“œ ???ë™ ?…ë¡œ?œìš©)
  const [youtubeClientId, setYoutubeClientId] = useState("")
  const [youtubeClientSecret, setYoutubeClientSecret] = useState("")
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isSavingProject, setIsSavingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDescription, setNewProjectDescription] = useState("")
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false)
  const [projectSearchQuery, setProjectSearchQuery] = useState("") // ?„ë¡œ?íŠ¸ ê²€?‰ì–´
  const [userId, setUserId] = useState<string>("") // ?¬ìš©??ID
  const [isEditingProjectName, setIsEditingProjectName] = useState(false)
  const [editingProjectName, setEditingProjectName] = useState("")

  // ?™ìŠ¤ë´?ì±—ë´‡ ?íƒœ
  const [isChatbotOpen, setIsChatbotOpen] = useState(false) // ì±—ë´‡ ?´ë¦¼/?«í˜
  const [chatbotMessages, setChatbotMessages] = useState<Array<{ type: "user" | "assistant"; content: string }>>([]) // ì±—ë´‡ ë©”ì‹œì§€
  const [chatbotInput, setChatbotInput] = useState<string>("") // ì±—ë´‡ ?…ë ¥
  const [isChatbotGenerating, setIsChatbotGenerating] = useState(false) // ì±—ë´‡ ?‘ë‹µ ?ì„± ì¤?
  // ?¤ì´ë²??¸ê¸° ?¤ì›Œ???íƒœ
  const [trendingKeywords, setTrendingKeywords] = useState<string[]>([])
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(false)
  const [showKeywordsDialog, setShowKeywordsDialog] = useState(false)

  // ?¤ì´ë²??¸ê¸° ?¤ì›Œ??ê°€?¸ì˜¤ê¸?  const handleLoadTrendingKeywords = async () => {
    setIsLoadingKeywords(true)
    setShowKeywordsDialog(true)
    
    // ìµœì†Œ 5ì´??™ì•ˆ ? ë‹ˆë©”ì´??? ì?
    const minLoadingTime = 5000
    const startTime = Date.now()
    
    try {
      const keywords = await getNaverTrendingKeywords("?¼í•‘")
      console.log("[Frontend] ë°›ì? ?¤ì›Œ??", keywords)
      
      // ìµœì†Œ ë¡œë”© ?œê°„??ì§€?˜ì? ?Šì•˜?¤ë©´ ?€ê¸?      const elapsedTime = Date.now() - startTime
      if (elapsedTime < minLoadingTime) {
        await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsedTime))
      }
      
      setTrendingKeywords(keywords || [])
      
      // ?¤ì›Œ?œê? ?†ìœ¼ë©?ê¸°ë³¸ ?¤ì›Œ???œì‹œ
      if (!keywords || keywords.length === 0) {
        const defaultKeywords = [
          "?œë¡œ",
          "?¨ë”©",
          "ì½”íŠ¸",
          "ëª©ë„ë¦?,
          "?¥ê°‘",
          "ë¶€ì¸?,
          "?ˆíŠ¸??,
          "?´ë³µ",
          "?´ìš”",
          "?„ê¸°?¥íŒ"
        ]
        setTrendingKeywords(defaultKeywords)
      }
    } catch (error) {
      console.error("?¸ê¸° ?¤ì›Œ??ë¡œë“œ ?¤íŒ¨:", error)
      
      // ìµœì†Œ ë¡œë”© ?œê°„??ì§€?˜ì? ?Šì•˜?¤ë©´ ?€ê¸?      const elapsedTime = Date.now() - startTime
      if (elapsedTime < minLoadingTime) {
        await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsedTime))
      }
      
      // ?ëŸ¬ ë°œìƒ ?œì—??ê¸°ë³¸ ?¤ì›Œ???œì‹œ
      const defaultKeywords = [
        "?œë¡œ",
        "?¨ë”©",
        "ì½”íŠ¸",
        "ëª©ë„ë¦?,
        "?¥ê°‘",
        "ë¶€ì¸?,
        "?ˆíŠ¸??,
        "?´ë³µ",
        "?´ìš”",
        "?„ê¸°?¥íŒ"
      ]
      setTrendingKeywords(defaultKeywords)
    } finally {
      setIsLoadingKeywords(false)
    }
  }

  // ?¤ì›Œ??? íƒ ???œí’ˆëª…ì— ?ë™ ?…ë ¥ + ì¿ íŒ¡ ê²€??  const handleSelectKeyword = (keyword: string) => {
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
        throw new Error(data.error || "ì¿ íŒ¡ ?í’ˆ??ê²€?‰í•˜ì§€ ëª»í–ˆ?µë‹ˆ??")
      }
      const products = Array.isArray(data.products) ? (data.products as CoupangRankedProduct[]) : []
      setCoupangProducts(products)
      if (!products.length) {
        setCoupangSearchError("?¼ì¹˜?˜ëŠ” ì¿ íŒ¡ ?í’ˆ??ì°¾ì? ëª»í–ˆ?µë‹ˆ?? ê²€?‰ì–´ë¥?ì§§ê²Œ ?˜ì •?´ë³´?¸ìš”.")
      }
    } catch (reason) {
      setCoupangSearchError(reason instanceof Error ? reason.message : "ì¿ íŒ¡ ê²€?‰ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤.")
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
        product.categoryName ? `ì¿ íŒ¡ ì¹´í…Œê³ ë¦¬: ${product.categoryName}` : "",
        product.isRocket ? "ë¡œì¼“ë°°ì†¡ ?í’ˆ" : "",
        `${product.productPrice.toLocaleString("ko-KR")}??,
        `${animalCharacter.name}??ê°€) ì¿ íŒ¡?ì„œ ê³ ë¥¸ ???œí’ˆ??ë§¤ì¥?ì„œ ?¤ì œë¡??œìš©Â·?œì—°?˜ëŠ” ?í¼`,
      ]
        .filter(Boolean)
        .join("\n")
    )
    setCoupangUrl(product.productUrl)
    // ?°ì„  CDN URLë¡??œì‹œ, ?´ì–´??nano-banana ì°¸ì¡°??data URLë¡?ë³€??    setProductImage(product.productImage)
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
          reader.onerror = () => reject(new Error("?´ë?ì§€ ë³€???¤íŒ¨"))
          reader.readAsDataURL(blob)
        })
        if (!dataUrl.startsWith("data:image/")) return
        setProductImage(dataUrl)
        const img = new Image()
        img.onload = () => setProductImageAspectRatio(img.width / img.height)
        img.src = dataUrl
        console.log("[Shopping] ì¿ íŒ¡ ?œí’ˆ ?´ë?ì§€ë¥??ˆí¼?°ìŠ¤ data URLë¡?ë³€???„ë£Œ")
      } catch (error) {
        console.warn("[Shopping] ì¿ íŒ¡ ?œí’ˆ ?´ë?ì§€ data URL ë³€???¤íŒ¨ (?ë³¸ URL ? ì?):", error)
      }
    })()
  }

  // ?¬ìš©??ID ê°€?¸ì˜¤ê¸?  useEffect(() => {
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
        console.error("[Shopping Projects] ?¬ìš©???•ë³´ ì¡°íšŒ ?¤íŒ¨:", error)
        const storedUserId = localStorage.getItem("user_id") || localStorage.getItem("user_email") || "anonymous"
        setUserId(storedUserId)
      }
    }
    
    fetchUserInfo()
  }, [])

  // ?ˆì•½ ë°œí–‰ ëª©ë¡ ë¡œë“œ (ShotForm ?¼í•‘)
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

  // ?ë™??ëª¨ë“œ ëª©ë¡ ë¡œë“œ
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

  // ê³µì¥ ?ë™ ?¤í–‰ ì¤‘ì¼ ???„ì¬ ?¨ê³„(activeStep)ë¥??ˆì•½ ??ª©??ë°˜ì˜
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

  // ?ˆì•½ ì¶”ê? ?¤ì´?¼ë¡œê·??´ë¦´ ???˜í¼??ëª©ë¡???†ìœ¼ë©??ë™ ë¡œë“œ
  useEffect(() => {
    if (showAddFactoryScheduleDialog && supertoneVoices.length === 0 && !isLoadingSupertoneVoices) {
      fetchSupertoneVoices()
    }
  }, [showAddFactoryScheduleDialog])

  // ?ë™??ëª¨ë“œ: ? íŠœë¸?ì±„ë„ ?°ë™ ?íƒœ ë¡œë“œ (localStorage) + OAuth ì½œë°± ì²˜ë¦¬
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
        access_denied: "YouTube ?°ë™??ì·¨ì†Œ?˜ì—ˆ?µë‹ˆ??",
        no_code: "?¸ì¦ ì½”ë“œë¥?ë°›ì? ëª»í–ˆ?µë‹ˆ??",
        config: "YouTube API ?¤ì •???•ì¸?´ì£¼?¸ìš”.",
        no_tokens: "? í°??ë°›ì? ëª»í–ˆ?µë‹ˆ?? ?¤ì‹œ ?œë„?´ì£¼?¸ìš”.",
        callback_failed: "?°ë™ ì²˜ë¦¬ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.",
      }
      alert(messages[errorFromUrl] || `?°ë™ ?¤ë¥˜: ${errorFromUrl}`)
      window.history.replaceState({}, "", window.location.pathname + (window.location.hash || ""))
    }
  }, [])

  // ?„ë¡œ?íŠ¸ ëª©ë¡ ë¶ˆëŸ¬?¤ê¸°
  useEffect(() => {
    if (userId && showProjectList) {
      loadProjects()
    }
  }, [userId, showProjectList])

  // ?¸ë„¤????œ¼ë¡??Œì•„?”ì„ ???¸ë„¤???¤ì‹œ ê·¸ë¦¬ê¸?  useEffect(() => {
    if (activeStep === "thumbnail" && thumbnailUrl && thumbnailCanvasRef.current) {
      // ? íƒ???¸ë„¤?¼ì´ AI ?ì„± ?¸ë„¤?¼ì¸ì§€ ?•ì¸
      const selectedThumbnail = selectedThumbnailIndex >= 0 ? thumbnailImages[selectedThumbnailIndex] : null
      if (selectedThumbnail && !selectedThumbnail.isCustom) {
        // AI ?ì„± ?¸ë„¤?¼ì? ?´ë? ?ìŠ¤?¸ê? ?¬í•¨?˜ì–´ ?ˆìœ¼ë¯€ë¡?ê·¸ë?ë¡??œì‹œ (ë¹„ìœ¨ ? ì?)
        const canvas = thumbnailCanvasRef.current
        const ctx = canvas.getContext("2d")
        if (ctx) {
          canvas.width = 1080
          canvas.height = 1920
          const img = new Image()
          img.crossOrigin = "anonymous"
          img.src = thumbnailUrl
          img.onload = () => {
            // ë¹„ìœ¨ ? ì??˜ë©° ê·¸ë¦¬ê¸?            const imgAspect = img.width / img.height
            const canvasAspect = canvas.width / canvas.height
            
            let drawWidth: number
            let drawHeight: number
            let offsetX: number
            let offsetY: number
            
            if (imgAspect > canvasAspect) {
              // ?´ë?ì§€ê°€ ???“ìŒ - ?’ì´??ë§ì¶”ê³?ì¢Œìš° ?¬ë¡­
              drawHeight = canvas.height
              drawWidth = drawHeight * imgAspect
              offsetX = (canvas.width - drawWidth) / 2
              offsetY = 0
            } else {
              // ?´ë?ì§€ê°€ ???’ìŒ - ?ˆë¹„??ë§ì¶”ê³??í•˜ ?¬ë¡­
              drawWidth = canvas.width
              drawHeight = drawWidth / imgAspect
              offsetX = 0
              offsetY = (canvas.height - drawHeight) / 2
            }
            
            // ê²€?€ ë°°ê²½?¼ë¡œ ì±„ìš°ê¸?            ctx.fillStyle = "black"
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            
            // ?´ë?ì§€ ê·¸ë¦¬ê¸?(ë¹„ìœ¨ ? ì?)
            ctx.drawImage(img, 0, 0, img.width, img.height, offsetX, offsetY, drawWidth, drawHeight)
          }
        }
      } else if (selectedThumbnail && selectedThumbnail.isCustom && thumbnailHookingText.line1) {
        // ì§ì ‘ ?ì„± ?¸ë„¤?¼ì? ?ìŠ¤?¸ë? ?Œë”ë§?        renderThumbnailWithText(thumbnailUrl, thumbnailHookingText)
      }
    }
  }, [activeStep, thumbnailUrl, thumbnailHookingText, selectedThumbnailIndex, thumbnailImages])

  // ì§ì ‘ ?ì„± ëª¨ë“œ: ?´ë?ì§€?€ ?ìŠ¤?¸ê? ëª¨ë‘ ?ˆì„ ???¤ì‹œê°?ë¯¸ë¦¬ë³´ê¸° ?…ë°?´íŠ¸
  useEffect(() => {
    if (thumbnailMode === "manual" && customThumbnailImage && customThumbnailText.line1 && customThumbnailText.line2) {
      renderThumbnailWithText(customThumbnailImage, customThumbnailText)
    }
  }, [thumbnailMode, customThumbnailImage, customThumbnailText, customThumbnailTextStyle])

  // ?„ì—­ ë§ˆìš°???´ë²¤?¸ë¡œ ?¸ë“¤ ?œë˜ê·?ì²˜ë¦¬
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!previewAudio) return
      
      // BGM ?¸ë“¤ ?œë˜ê·?      if (draggingBgmHandle && bgmUrl && bgmTimelineRef.current) {
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
      
      // ?¨ê³¼???¸ë“¤ ?œë˜ê·?      if (draggingSfxHandle && sfxUrl && sfxTimelineRef.current) {
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

  // BGM URL ë³€ê²????´ì „ BGM ?•ë¦¬
  useEffect(() => {
    return () => {
      // ì»´í¬?ŒíŠ¸ ?¸ë§ˆ?´íŠ¸ ?ëŠ” bgmUrl ë³€ê²????´ì „ BGM ?•ë¦¬
      if (previewBgmAudio) {
        console.log("[Shopping] BGM URL ë³€ê²??ëŠ” ì»´í¬?ŒíŠ¸ ?¸ë§ˆ?´íŠ¸ - ?´ì „ BGM ?•ë¦¬")
        previewBgmAudio.pause()
        previewBgmAudio.currentTime = 0
        previewBgmAudio.src = "" // ?¤ë””???ŒìŠ¤ ?œê±°
        previewBgmAudio.load() // ?¤ë””??ë¦¬ì†Œ???´ì œ
        setPreviewBgmAudio(null)
      }
    }
  }, [bgmUrl, previewBgmAudio])

  // ?¤ë””???¼ì´ë¸ŒëŸ¬ë¦?ë¡œë“œ
  useEffect(() => {
    const loadAudioLibrary = async () => {
      if (activeStep === "preview") {
        console.log("[Shopping] ?¤ë””???¼ì´ë¸ŒëŸ¬ë¦?ë¡œë“œ ?œì‘ (?´ë¼?´ì–¸??")
        setIsLoadingAudioLibrary(true)
        try {
          console.log("[Shopping] getAllAudioLibrary ?¸ì¶œ ??)
          const result = await getAllAudioLibrary()
          console.log("[Shopping] getAllAudioLibrary ?¸ì¶œ ??- ê²°ê³¼:", result)
          console.log("[Shopping] ?¤ë””???¼ì´ë¸ŒëŸ¬ë¦?ë¡œë“œ ?„ë£Œ - BGM:", result.bgm.length, "ê°? SFX:", result.sfx.length, "ê°?)
          console.log("[Shopping] BGM ëª©ë¡:", result.bgm.map(a => a.name))
          console.log("[Shopping] SFX ëª©ë¡:", result.sfx.map(a => a.name))
          setBgmLibrary(result.bgm)
          setSfxLibrary(result.sfx)
        } catch (error) {
          console.error("[Shopping] ?¤ë””???¼ì´ë¸ŒëŸ¬ë¦?ë¡œë“œ ?¤íŒ¨ (?´ë¼?´ì–¸??:", error)
          // ?ëŸ¬ê°€ ë°œìƒ?´ë„ ë¹?ë°°ì—´ë¡??¤ì •
          setBgmLibrary([])
          setSfxLibrary([])
        } finally {
          setIsLoadingAudioLibrary(false)
        }
      } else {
        // preview ?¨ê³„ê°€ ?„ë‹ˆë©??¼ì´ë¸ŒëŸ¬ë¦?ì´ˆê¸°??        setBgmLibrary([])
        setSfxLibrary([])
      }
    }
    loadAudioLibrary()
  }, [activeStep])

  // preview ?¨ê³„ ì§„ì… ??? íŠœë¸?ë©”í??°ì´???ë™ ?ì„±
  useEffect(() => {
    const generateMetadataOnPreview = async () => {
      // preview ?¨ê³„?´ê³ , ?€ë³¸ì´ ?ˆê³ , ë©”í??°ì´?°ê? ?†ì„ ?Œë§Œ ?ë™ ?ì„±
      if (activeStep === "preview" && script.trim() && !youtubeTitle && !youtubeDescription && youtubeTags.length === 0) {
        const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined
        
        if (openaiApiKey) {
          console.log("[Shopping] preview ?¨ê³„ ì§„ì…, ? íŠœë¸?ë©”í??°ì´???ë™ ?ì„± ?œì‘")
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
            console.log("[Shopping] ? íŠœë¸?ë©”í??°ì´???ë™ ?ì„± ?„ë£Œ")
          } catch (error) {
            console.error("ë©”í??°ì´???ë™ ?ì„± ?¤íŒ¨:", error)
            // ?ë™ ?ì„± ?¤íŒ¨?´ë„ ê³„ì† ì§„í–‰ (?¬ìš©?ê? ?˜ë™?¼ë¡œ ?ì„±?????ˆìŒ)
          } finally {
            setIsGeneratingMetadata(false)
          }
        }
      }
    }

    generateMetadataOnPreview()
  }, [activeStep, script, productName, productDescription, youtubeTitle, youtubeDescription, youtubeTags])

  // ?„ë¡œ?íŠ¸ ëª©ë¡ ë¡œë“œ
  const loadProjects = async () => {
    if (!userId) return
    
    setIsLoadingProjects(true)
    try {
      const projectsList = await getShoppingProjects(userId)
      // ìµœì‹  ?‘ì—… ?œìœ¼ë¡??•ë ¬ (updated_at ê¸°ì?, ?†ìœ¼ë©?created_at ê¸°ì?)
      const sortedProjects = [...projectsList].sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at).getTime()
        const dateB = new Date(b.updated_at || b.created_at).getTime()
        return dateB - dateA // ìµœì‹ ??(?´ë¦¼ì°¨ìˆœ)
      })
      setProjects(sortedProjects)
    } catch (error) {
      console.error("?„ë¡œ?íŠ¸ ëª©ë¡ ë¡œë“œ ?¤íŒ¨:", error)
      alert("?„ë¡œ?íŠ¸ ëª©ë¡??ë¶ˆëŸ¬?¤ëŠ”???¤íŒ¨?ˆìŠµ?ˆë‹¤.")
    } finally {
      setIsLoadingProjects(false)
    }
  }

  // ?„ë¡œ?íŠ¸ ?€??  const saveProject = async (projectName?: string, isNewProject: boolean = false) => {
    if (!userId) {
      alert("ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ??")
      return
    }

    // ?„ë¡œ?íŠ¸ ?´ë¦„ ê²°ì • (?œí’ˆëª…ê³¼ ë³„ë„ë¡?ê´€ë¦?
    let name: string
    if (isNewProject) {
      // ???„ë¡œ?íŠ¸ ?ì„± ?? ë°˜ë“œ???…ë ¥ë°›ì? ?´ë¦„ ?¬ìš©
      name = newProjectName || projectName || "???„ë¡œ?íŠ¸"
    } else if (currentProject) {
      // ê¸°ì¡´ ?„ë¡œ?íŠ¸ ?…ë°?´íŠ¸ ?? ?„ì¬ ?„ë¡œ?íŠ¸ ?´ë¦„ ? ì? ?ëŠ” ?…ë ¥ë°›ì? ?´ë¦„ ?¬ìš©
      name = projectName || currentProject.name
    } else {
      // ?„ë¡œ?íŠ¸ê°€ ?†ëŠ” ê²½ìš°: ?…ë ¥ë°›ì? ?´ë¦„ ?ëŠ” ê¸°ë³¸ê°?      name = projectName || newProjectName || "???„ë¡œ?íŠ¸"
    }
    
    if (!name.trim()) {
      alert("?„ë¡œ?íŠ¸ ?´ë¦„???…ë ¥?´ì£¼?¸ìš”.")
      return
    }

    setIsSavingProject(true)
    try {
      // TTS: ?”ë©´???˜ì˜¤???¤ë””??URL ê·¸ë?ë¡??€??(TTS ?ì„± ???´ë? Supabase ?…ë¡œ?œí•œ ?êµ¬ URL?´ë©´ ê·¸ë?ë¡? blob?´ë©´ ?…ë¡œ????URLë¡??€??
      let finalTtsAudioUrl = ttsAudioUrl && ttsAudioUrl.trim() ? ttsAudioUrl : undefined
      if (finalTtsAudioUrl && finalTtsAudioUrl.startsWith("blob:")) {
        const projectIdForUpload = currentProject?.id
        if (projectIdForUpload) {
        try {
          const audioResponse = await fetch(finalTtsAudioUrl)
          const audioBlob = await audioResponse.blob()
            finalTtsAudioUrl = await uploadTTSAudio(audioBlob, projectIdForUpload, userId)
        } catch (uploadError) {
            console.error("[Shopping] ?¤ë””???…ë¡œ???¤íŒ¨:", uploadError)
            finalTtsAudioUrl = currentProject?.data?.ttsAudioUrl && !currentProject.data.ttsAudioUrl.startsWith("blob:") ? currentProject.data.ttsAudioUrl : undefined
          }
        } else {
          finalTtsAudioUrl = undefined
        }
      }
      if (currentProject && !isNewProject && finalTtsAudioUrl && finalTtsAudioUrl.startsWith("blob:")) {
        finalTtsAudioUrl = currentProject.data?.ttsAudioUrl && !currentProject.data.ttsAudioUrl.startsWith("blob:") ? currentProject.data.ttsAudioUrl : undefined
      }
      // ê¸°ì¡´ ?„ë¡œ?íŠ¸ ?…ë°?´íŠ¸ ?? final???†ì–´??ê¸°ì¡´ ttsAudioUrl ??–´?°ì? ?ŠìŒ (?…ë¡œ???¤íŒ¨ ??? ì?)
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
        // ê¸°ì¡´ ?„ë¡œ?íŠ¸ ?…ë°?´íŠ¸
        await updateShoppingProject(currentProject.id, {
          name,
          description: newProjectDescription || undefined,
          data: projectData,
        })
        if (ttsAudioUrlToSave && !ttsAudioUrlToSave.startsWith("blob:")) {
          setTtsAudioUrl(ttsAudioUrlToSave)
        }
        alert("?„ë¡œ?íŠ¸ê°€ ?€?¥ë˜?ˆìŠµ?ˆë‹¤.")
      } else {
        // ???„ë¡œ?íŠ¸ ?ì„± ?„ì— ëª¨ë“  ?íƒœ ì´ˆê¸°??        const freshCharacter = createDefaultAnimalCharacter()
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
        setSelectedVoiceId("ttsmaker-?¬ì„±1")
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
        
        // ë¹??°ì´?°ë¡œ ???„ë¡œ?íŠ¸ ?ì„±
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
        setCurrentProject(newProject) // ???„ë¡œ?íŠ¸ë¡??„í™˜
        
        // ???„ë¡œ?íŠ¸ ?ì„± ???¤ë””?¤ê? ?„ì‹œ URL?´ë©´ ?…ë¡œ??        if (finalTtsAudioUrl && finalTtsAudioUrl.startsWith("blob:")) {
          try {
            console.log("[Shopping] ???„ë¡œ?íŠ¸ ?ì„± ???¤ë””???Œì¼ ?…ë¡œ??ì¤?..")
            const audioResponse = await fetch(finalTtsAudioUrl)
            const audioBlob = await audioResponse.blob()
            const uploadedAudioUrl = await uploadTTSAudio(audioBlob, newProject.id, userId)
            
            // ?…ë¡œ?œëœ URLë¡??„ë¡œ?íŠ¸ ?…ë°?´íŠ¸
            await updateShoppingProject(newProject.id, {
              data: {
                ...projectData,
                ttsAudioUrl: uploadedAudioUrl,
              },
            })
            
            // ?íƒœ???…ë°?´íŠ¸
            setTtsAudioUrl(uploadedAudioUrl)
            console.log("[Shopping] ???„ë¡œ?íŠ¸ ?¤ë””???Œì¼ ?…ë¡œ???„ë£Œ:", uploadedAudioUrl)
          } catch (uploadError) {
            console.error("[Shopping] ???„ë¡œ?íŠ¸ ?¤ë””???Œì¼ ?…ë¡œ???¤íŒ¨:", uploadError)
          }
        }
        
        setShowCreateProjectDialog(false)
        setNewProjectName("")
        setNewProjectDescription("")
        setShowProjectList(false) // ?„ë¡œ?íŠ¸ ëª©ë¡ ?«ê³  ?‘ì—… ?”ë©´?¼ë¡œ ?´ë™
      }
      
      await loadProjects()
    } catch (error) {
      console.error("?„ë¡œ?íŠ¸ ?€???¤íŒ¨:", error)
      alert("?„ë¡œ?íŠ¸ ?€?¥ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤.")
    } finally {
      setIsSavingProject(false)
    }
  }

  // ?„ë¡œ?íŠ¸ ë¶ˆëŸ¬?¤ê¸°
  const loadProject = async (projectId: string) => {
    try {
      const project = await getShoppingProject(projectId)
      if (!project) {
        alert("?„ë¡œ?íŠ¸ë¥?ì°¾ì„ ???†ìŠµ?ˆë‹¤.")
        return
      }

      const data = project.data
      
      // ?„ë¡œ?íŠ¸ ?°ì´??ë³µì› (TTS ?íƒœ ?¬í•¨)
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
        // ?´ë?ì§€ ë¹„ìœ¨ ê³„ì‚°
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
      // TTS ?¤ë””??URL ë³µì› (ë¹?ë¬¸ì?´ì´ ?„ë‹Œ ê²½ìš°?ë§Œ)
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
      console.error("?„ë¡œ?íŠ¸ ë¶ˆëŸ¬?¤ê¸° ?¤íŒ¨:", error)
      alert("?„ë¡œ?íŠ¸ë¥?ë¶ˆëŸ¬?¤ëŠ”???¤íŒ¨?ˆìŠµ?ˆë‹¤.")
    }
  }

  // ?„ë¡œ?íŠ¸ ?? œ
  const handleDeleteProject = async (projectId: string) => {
    if (!confirm("?•ë§ ???„ë¡œ?íŠ¸ë¥??? œ?˜ì‹œê² ìŠµ?ˆê¹Œ?")) return

    try {
      await deleteShoppingProject(projectId)
      if (currentProject?.id === projectId) {
        setCurrentProject(null)
        setShowProjectList(true)
      }
      await loadProjects()
      alert("?„ë¡œ?íŠ¸ê°€ ?? œ?˜ì—ˆ?µë‹ˆ??")
    } catch (error) {
      console.error("?„ë¡œ?íŠ¸ ?? œ ?¤íŒ¨:", error)
      alert("?„ë¡œ?íŠ¸ ?? œ???¤íŒ¨?ˆìŠµ?ˆë‹¤.")
    }
  }

  // ?Œì¼ ì²˜ë¦¬ ê³µí†µ ?¨ìˆ˜
  const processImageFile = (file: File) => {
    // ?´ë?ì§€ ?Œì¼?¸ì? ?•ì¸
    if (!file.type.startsWith("image/")) {
      alert("?´ë?ì§€ ?Œì¼ë§??…ë¡œ??ê°€?¥í•©?ˆë‹¤.")
      return
    }

    // ?Œì¼ ?¬ê¸° ?œí•œ (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert("?´ë?ì§€ ?¬ê¸°??10MB ?´í•˜?¬ì•¼ ?©ë‹ˆ??")
      return
    }

    setProductImageFile(file)

    // ë¯¸ë¦¬ë³´ê¸°ë¥??„í•œ URL ?ì„±
    const reader = new FileReader()
    reader.onloadend = () => {
      const imageUrl = reader.result as string
      setProductImage(imageUrl)
      
      // ?´ë?ì§€ ë¹„ìœ¨ ê³„ì‚°
      const img = new Image()
      img.onload = () => {
        const aspectRatio = img.width / img.height
        setProductImageAspectRatio(aspectRatio)
        console.log(`[Shopping] ?œí’ˆ ?´ë?ì§€ ë¹„ìœ¨: ${img.width}x${img.height} = ${aspectRatio.toFixed(2)}`)
      }
      img.src = imageUrl
    }
    reader.readAsDataURL(file)
  }

  // ?´ë?ì§€ ?…ë¡œ??ì²˜ë¦¬
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    processImageFile(file)
  }

  // ?œë˜ê·????œë¡­ ì²˜ë¦¬
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

  // ?´ë?ì§€ ?œê±°
  const handleRemoveImage = () => {
    setProductImage(null)
    setProductImageFile(null)
    setProductImageAspectRatio(null)
    setSelectedCoupangProduct(null)
    setCoupangUrl("")
  }

  // ?™ìŠ¤ë´?ì±—ë´‡ ë©”ì‹œì§€ ?„ì†¡ ?¨ìˆ˜
  const handleChatbotSend = async () => {
    if (!chatbotInput.trim() || isChatbotGenerating) return

    const userMessage = chatbotInput.trim()
    setChatbotInput("")
    setChatbotMessages((prev) => [...prev, { type: "user", content: userMessage }])
    setIsChatbotGenerating(true)

    try {
      // WingsAIStudioShotForm ?¤ì •?ì„œ OpenAI API ??ê°€?¸ì˜¤ê¸?      const apiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || null : null
      if (!apiKey) {
        setChatbotMessages((prev) => [...prev, {
          type: "assistant",
          content: "OpenAI API ?¤ê? ?„ìš”?©ë‹ˆ?? ?¤ì •?ì„œ API ?¤ë? ?…ë ¥?´ì£¼?¸ìš”."
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
              content: "?¹ì‹ ?€ ?™ìŠ¤ë´‡ì…?ˆë‹¤. WingsAIStudioShotForm??AI ?´ì‹œ?¤í„´?¸ë¡œ???¬ìš©?ì—ê²?ì¹œì ˆ?˜ê³  ?„ì????˜ëŠ” ?µë????œê³µ?©ë‹ˆ?? ?¼í•‘ ?í¼ ?ìƒ ?œì‘, ?€ë³??‘ì„±, ?´ë?ì§€ ?ì„±, TTS ?±ì— ?€??ì§ˆë¬¸???µë??????ˆìŠµ?ˆë‹¤."
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
        throw new Error(errorData.error?.message || "?‘ë‹µ ?ì„±???¤íŒ¨?ˆìŠµ?ˆë‹¤.")
      }

      const data = await response.json()
      const reply = data.choices[0]?.message?.content || "?‘ë‹µ ?ì„±???¤íŒ¨?ˆìŠµ?ˆë‹¤."

      setChatbotMessages((prev) => [...prev, { type: "assistant", content: reply }])
    } catch (error) {
      console.error("ì±—ë´‡ ?‘ë‹µ ?ì„± ?¤íŒ¨:", error)
      const errorMessage = error instanceof Error ? error.message : "?????†ëŠ” ?¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤."
      setChatbotMessages((prev) => [...prev, {
        type: "assistant",
        content: `ì£„ì†¡?©ë‹ˆ?? ?¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤: ${errorMessage}`
      }])
    } finally {
      setIsChatbotGenerating(false)
    }
  }

  const handleSelectCharacterPreset = (presetId: string) => {
    const next = createCharacterFromPreset(presetId)
    // ê°™ì? ?„ë¦¬?‹ì„ ?¤ì‹œ ê³¨ë¼???ˆí¼?°ìŠ¤??? ì??˜ì? ?ŠìŒ (??ìºë¦­??
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
      alert("?´ë?ì§€ ?Œì¼ë§??…ë¡œ??ê°€?¥í•©?ˆë‹¤.")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("?´ë?ì§€ ?¬ê¸°??10MB ?´í•˜?¬ì•¼ ?©ë‹ˆ??")
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
      alert("ì»¤ìŠ¤?€ ìºë¦­?°ëŠ” ?¸í˜• ?¤ëª…??ë¨¼ì? ?…ë ¥?´ì£¼?¸ìš”.")
      return
    }
    const replicateApiKey =
      typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined
    if (!replicateApiKey) {
      alert("Replicate API ?¤ê? ?„ìš”?©ë‹ˆ?? ë©”ì¸ ?”ë©´???¤ì •?ì„œ API ?¤ë? ?…ë ¥?´ì£¼?¸ìš”.")
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
      console.error("ìºë¦­???ˆí¼?°ìŠ¤ ?ì„± ?¤íŒ¨:", err)
      setError(`ìºë¦­???ì„±???¤íŒ¨?ˆìŠµ?ˆë‹¤: ${err instanceof Error ? err.message : "?????†ëŠ” ?¤ë¥˜"}`)
    } finally {
      setIsGeneratingCharacterRef(false)
    }
  }

  // ?€ë³??ì„±
  const handleGenerateScript = async () => {
    if (!productName.trim()) {
      alert("?œí’ˆëª…ì„ ?…ë ¥?´ì£¼?¸ìš”.")
      return
    }
    if (animalCharacter.presetId === "custom" && !animalCharacter.breedOrLook.trim()) {
      alert("ìºë¦­???¸í˜• ?¤ëª…???…ë ¥?˜ê±°???„ë¦¬?‹ì„ ? íƒ?´ì£¼?¸ìš”.")
      return
    }

    const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined

    if (!openaiApiKey) {
      alert("OpenAI API ?¤ê? ?„ìš”?©ë‹ˆ?? ë©”ì¸ ?”ë©´???¤ì •(?±ë‹ˆë°”í€??„ì´ì½??ì„œ API ?¤ë? ?…ë ¥?´ì£¼?¸ìš”.")
      return
    }

    setIsGeneratingScript(true)
    setError("")

    try {
      // ?œí’ˆ ?¤ëª…???ˆìœ¼ë©?ê·¸ê²ƒ??ê¸°ë°˜?¼ë¡œ, ?†ìœ¼ë©??œí’ˆëª…ë§Œ ?¬ìš©
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
      
      // ?€ë³??ì„± ???ë™?¼ë¡œ ?ŒíŠ¸ ë¶„ì„
      try {
        setIsAnalyzingScript(true)
        const parts = await analyzeScriptParts(generatedScript, openaiApiKey)
        setScriptParts(parts)
      } catch (error) {
        console.error("?€ë³?ë¶„ì„ ?¤íŒ¨:", error)
        setScriptParts([])
      } finally {
        setIsAnalyzingScript(false)
      }
    } catch (error) {
      console.error("?€ë³??ì„± ?¤íŒ¨:", error)
      setError(`?€ë³??ì„±???¤íŒ¨?ˆìŠµ?ˆë‹¤: ${error instanceof Error ? error.message : "?????†ëŠ” ?¤ë¥˜"}`)
    } finally {
      setIsGeneratingScript(false)
    }
  }

  // ?€ë³??¸ì§‘ ?€??  const handleSaveEditedScript = () => {
    setScript(editedScript)
    setIsEditingScript(false)
  }

  // BGM ?Œì¼ ?…ë¡œ??  const handleBgmUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("audio/")) {
      alert("?¤ë””???Œì¼ë§??…ë¡œ??ê°€?¥í•©?ˆë‹¤.")
      return
    }

    setBgmFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setBgmUrl(reader.result as string)
      
      // ê¸°ë³¸ ì¢…ë£Œ ?œê°„??10ì´ˆë¡œ ?¤ì •
      setBgmEndTime(10)
    }
    reader.readAsDataURL(file)
  }

  // ?¨ê³¼???Œì¼ ?…ë¡œ??  const handleSfxUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("audio/")) {
      alert("?¤ë””???Œì¼ë§??…ë¡œ??ê°€?¥í•©?ˆë‹¤.")
      return
    }

    setSfxFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setSfxUrl(reader.result as string)
      
      // ?Œì¼ ?¬ê¸° ?•ì¸ ë°?ê¸°ë³¸ ì¢…ë£Œ ?œê°„ ?¤ì •
      const audio = new Audio(reader.result as string)
      audio.onloadedmetadata = () => {
        if (sfxEndTime === 0 || sfxEndTime > audio.duration) {
          setSfxEndTime(audio.duration)
        }
      }
    }
    reader.readAsDataURL(file)
  }

  // ?¤ë””???¼ì´ë¸ŒëŸ¬ë¦¬ì—??BGM ? íƒ
  const handleSelectBgmFromLibrary = (audioItem: AudioLibraryItem) => {
    setBgmUrl(audioItem.url)
    setBgmFile(null) // ?¼ì´ë¸ŒëŸ¬ë¦¬ì—??? íƒ??ê²½ìš° ?Œì¼?€ null
    
    // ê¸°ë³¸ ì¢…ë£Œ ?œê°„??10ì´ˆë¡œ ?¤ì •
    setBgmEndTime(10)
    setShowBgmLibraryDialog(false)
  }

  // BGM ?? œ
  const handleDeleteBgm = () => {
    // BGM ?•ë¦¬
    if (previewBgmAudio) {
      previewBgmAudio.pause()
      previewBgmAudio.currentTime = 0
      previewBgmAudio.src = ""
      previewBgmAudio.load()
      setPreviewBgmAudio(null)
    }
    
    // ?íƒœ ì´ˆê¸°??    setBgmUrl("")
    setBgmFile(null)
    setBgmVolume(0.3)
    setBgmStartTime(0)
    setBgmEndTime(0)
  }

  // ?¨ê³¼???? œ
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

  // ?¤ë””???¼ì´ë¸ŒëŸ¬ë¦¬ì—???¨ê³¼??? íƒ
  const handleSelectSfxFromLibrary = (audioItem: AudioLibraryItem) => {
    setSfxUrl(audioItem.url)
    setSfxFile(null) // ?¼ì´ë¸ŒëŸ¬ë¦¬ì—??? íƒ??ê²½ìš° ?Œì¼?€ null
    
    // ?¤ë””??ê¸¸ì´ ?•ì¸
    const audio = new Audio(audioItem.url)
    audio.onloadedmetadata = () => {
      if (sfxEndTime === 0 || sfxEndTime > audio.duration) {
        setSfxEndTime(audio.duration)
      }
    }
    setShowSfxLibraryDialog(false)
  }

  // ?œëª©/?¤ëª…/?œê·¸ ?ë™ ?ì„±
  const handleGenerateMetadata = async () => {
    if (!script.trim()) {
      alert("?€ë³¸ì´ ?†ìŠµ?ˆë‹¤. ë¨¼ì? ?€ë³¸ì„ ?ì„±?´ì£¼?¸ìš”.")
      return
    }

    const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined

    if (!openaiApiKey) {
      alert("OpenAI API ?¤ê? ?„ìš”?©ë‹ˆ??")
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
      console.error("ë©”í??°ì´???ì„± ?¤íŒ¨:", error)
      alert(`ë©”í??°ì´???ì„±???¤íŒ¨?ˆìŠµ?ˆë‹¤: ${error instanceof Error ? error.message : "?????†ëŠ” ?¤ë¥˜"}`)
    } finally {
      setIsGeneratingMetadata(false)
    }
  }

  // ?˜í¼???Œì„± ëª©ë¡ ê°€?¸ì˜¤ê¸?  const fetchSupertoneVoices = async () => {
    setIsLoadingSupertoneVoices(true)
    try {
      // WingsAIStudioShotForm ?¤ì •ì°½ì—?œë§Œ API ??ê°€?¸ì˜¤ê¸?      const supertoneApiKey = typeof window !== "undefined" 
        ? (localStorage.getItem("shotform_supertone_api_key") || "").trim() 
        : null
      if (!supertoneApiKey || supertoneApiKey.length === 0) {
        alert("?˜í¼??API ?¤ê? ?„ìš”?©ë‹ˆ?? ?¤ì •?ì„œ API ?¤ë? ?…ë ¥?´ì£¼?¸ìš”.\n\n?˜í¼??API ì½˜ì†”(console.supertoneapi.com)?ì„œ API ?¤ë? ë°œê¸‰ë°›ì„ ???ˆìŠµ?ˆë‹¤.")
        setIsLoadingSupertoneVoices(false)
        return
      }

      // API ???•ì‹ ê²€ì¦?      if (supertoneApiKey.length < 20) {
        alert(`?˜í¼??API ???•ì‹???¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤. (ê¸¸ì´: ${supertoneApiKey.length}??\n\n?˜í¼??API ì½˜ì†”(console.supertoneapi.com)?ì„œ ?¬ë°”ë¥?API ?¤ë? ?•ì¸?˜ê³  ?¤ì‹œ ?…ë ¥?´ì£¼?¸ìš”.`)
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
        throw new Error(errorData.error || "?Œì„± ëª©ë¡??ê°€?¸ì˜¤?”ë° ?¤íŒ¨?ˆìŠµ?ˆë‹¤.")
      }

      const data = await response.json()
      if (data.success && data.voices) {
        const excludedNames = ["?¬íŒ½?´A", "ê¸°ì–µ?˜ì •???Œë§ˆ??, "?ˆìƒˆ?˜ì •???Œë§ˆ??]
        const filteredVoices = data.voices.filter((voice: { name: string }) => 
          !excludedNames.some(excluded => voice.name.includes(excluded))
        )
        setSupertoneVoices(filteredVoices)
        if (filteredVoices.length > 0 && !selectedSupertoneVoiceId) {
          setSelectedSupertoneVoiceId(filteredVoices[0].voice_id)
          setSelectedVoiceId(`supertone-${filteredVoices[0].voice_id}`)
        }
      } else {
        throw new Error(data.error || "?Œì„± ëª©ë¡??ê°€?¸ì˜¤?”ë° ?¤íŒ¨?ˆìŠµ?ˆë‹¤.")
      }
    } catch (error) {
      console.error("?˜í¼???Œì„± ëª©ë¡ ê°€?¸ì˜¤ê¸??¤íŒ¨:", error)
      alert(`?˜í¼???Œì„± ëª©ë¡??ê°€?¸ì˜¤?”ë° ?¤íŒ¨?ˆìŠµ?ˆë‹¤: ${error instanceof Error ? error.message : "?????†ëŠ” ?¤ë¥˜"}`)
    } finally {
      setIsLoadingSupertoneVoices(false)
    }
  }

  // ëª©ì†Œë¦?ë¯¸ë¦¬?£ê¸° ?¨ìˆ˜
  const handlePreviewVoice = async (voiceId: string) => {
    setPreviewingVoiceId(voiceId)
    
    try {
      let response: Response
      
      if (voiceId?.startsWith("supertone-")) {
        const actualVoiceId = voiceId.replace("supertone-", "")
        // WingsAIStudioShotForm ?¤ì •ì°½ì—?œë§Œ API ??ê°€?¸ì˜¤ê¸?        const supertoneApiKey = typeof window !== "undefined" 
          ? (localStorage.getItem("shotform_supertone_api_key") || "").trim() 
          : null
        
        if (!supertoneApiKey) {
          alert("?˜í¼??API ?¤ê? ?„ìš”?©ë‹ˆ?? ?¤ì •?ì„œ API ?¤ë? ?…ë ¥?´ì£¼?¸ìš”.")
          setPreviewingVoiceId(null)
          return
        }
        
        response = await fetch("/api/supertone-tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: "?¬ëŸ¬ë¶??˜ì˜?©ë‹ˆ??,
            voiceId: actualVoiceId,
            apiKey: supertoneApiKey,
            style: selectedSupertoneStyle || "neutral",
            language: "ko",
          }),
        })
      } else if (voiceId?.startsWith("ttsmaker-")) {
        const voiceName = voiceId.replace("ttsmaker-", "")
        const pitch = voiceName === "?¨ì„±5" ? 0.9 : 1.0
        const ttsmakerApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_ttsmaker_api_key") || undefined : undefined

        if (!ttsmakerApiKey) {
          alert("TTSMaker API ?¤ê? ?„ìš”?©ë‹ˆ?? ?¤ì •?ì„œ API ?¤ë? ?…ë ¥?´ì£¼?¸ìš”.")
          setPreviewingVoiceId(null)
          return
        }
        
        response = await fetch("/api/ttsmaker", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: "?¬ëŸ¬ë¶??˜ì˜?©ë‹ˆ??,
            voice: voiceName,
            speed: 1.0,
            pitch: pitch,
            apiKey: ttsmakerApiKey,
          }),
        })
      } else if (voiceId?.startsWith("elevenlabs-")) {
        // ElevenLabs??ê²½ìš° - ?‘ë‘???œê±°
        const cleanVoiceId = voiceId.replace("elevenlabs-", "")
        // WingsAIStudioShotForm ?¤ì •ì°½ì—?œë§Œ API ??ê°€?¸ì˜¤ê¸?        let elevenlabsApiKey = typeof window !== "undefined" 
          ? (localStorage.getItem("shotform_elevenlabs_api_key") || "").trim() 
          : null
        
        if (!elevenlabsApiKey || elevenlabsApiKey.length === 0) {
          alert("ElevenLabs API ?¤ê? ?„ìš”?©ë‹ˆ?? ?¤ì •?ì„œ API ?¤ë? ?…ë ¥?´ì£¼?¸ìš”.")
          setPreviewingVoiceId(null)
          return
        }
        
        response = await fetch("/api/elevenlabs-tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: "?¬ëŸ¬ë¶??˜ì˜?©ë‹ˆ??,
            voiceId: cleanVoiceId, // ?‘ë‘???œê±°???œìˆ˜ Voice ID
            apiKey: elevenlabsApiKey,
          }),
        })
      } else {
        // ê¸°ë³¸ TTSMaker ì²˜ë¦¬ (?‘ë‘???†ëŠ” ê²½ìš°)
        const voiceName = voiceId.replace("ttsmaker-", "") || "?¬ì„±1"
        const pitch = voiceName === "?¨ì„±5" ? 0.9 : 1.0
        const ttsmakerApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_ttsmaker_api_key") || undefined : undefined

        if (!ttsmakerApiKey) {
          alert("TTSMaker API ?¤ê? ?„ìš”?©ë‹ˆ?? ?¤ì •?ì„œ API ?¤ë? ?…ë ¥?´ì£¼?¸ìš”.")
          setPreviewingVoiceId(null)
          return
        }
        
        response = await fetch("/api/ttsmaker", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: "?¬ëŸ¬ë¶??˜ì˜?©ë‹ˆ??,
            voice: voiceName,
            speed: 1.0,
            pitch: pitch,
            apiKey: ttsmakerApiKey,
          }),
        })
      }

      if (!response.ok) {
        let errorMessage = "ë¯¸ë¦¬?£ê¸° ?¤íŒ¨"
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
      console.error("ë¯¸ë¦¬?£ê¸° ?¤íŒ¨:", error)
      alert(`ë¯¸ë¦¬?£ê¸°???¤íŒ¨?ˆìŠµ?ˆë‹¤: ${error instanceof Error ? error.message : "?????†ëŠ” ?¤ë¥˜"}`)
      setPreviewingVoiceId(null)
      setPreviewAudioUrl(null)
    }
  }

  // TTS ?ì„± (3ê°??¥ë©´ ?„ì²´ ?€ë³? - ?´ë?ì§€ ?ì„±ë³´ë‹¤ ë¨¼ì?
  const handleGenerateTTS = async () => {
    if (!script.trim()) {
      alert("?€ë³¸ì´ ?†ìŠµ?ˆë‹¤.")
      return
    }

    // ?¬ìƒ????ê¸°ì¡´ ?¤ë””??URL ì´ˆê¸°??    if (ttsAudioUrl) {
      // Blob URL??ê²½ìš° ë©”ëª¨ë¦??´ì œ
      if (ttsAudioUrl.startsWith("blob:")) {
        URL.revokeObjectURL(ttsAudioUrl)
      }
      setTtsAudioUrl("")
    }

    setIsGeneratingTTS(true)
    setTtsProgress({ current: 0, total: 1 })
    setError("")

    try {
      // ?„ì²´ ?€ë³¸ì„ ??ë²ˆì— TTS ?ì„± (?€ë³?ê·¸ë?ë¡??¬ìš© - ?ˆë? ?Šê¸°ë©??ˆë¨)
      console.log("[Shopping] TTS ?ì„± ì¤?.. (ëª©ì†Œë¦?", selectedVoiceId, ")")
      console.log("[Shopping] ?€ë³??„ì²´ ê¸¸ì´:", script.length, "??)
      console.log("[Shopping] ?€ë³??„ì²´ ?´ìš©:", script)
      
      // ?€ë³¸ì„ ê·¸ë?ë¡??¬ìš© (?„ì²˜ë¦??†ì´ ?ë³¸ ê·¸ë?ë¡?
      // ?ˆë? ?€ë³¸ì„ ?˜ì •?˜ê±°???ë¥´ì§€ ?ŠìŒ
      const ttsText = script.trim()
      
      console.log("[Shopping] TTS???„ë‹¬???€ë³?ê¸¸ì´:", ttsText.length, "??)
      console.log("[Shopping] TTS???„ë‹¬???€ë³??´ìš©:", ttsText)
      
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
          alert("?˜í¼??API ?¤ê? ?„ìš”?©ë‹ˆ?? ?¤ì •?ì„œ API ?¤ë? ?…ë ¥?´ì£¼?¸ìš”.")
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
          alert("?€?…ìº?¤íŠ¸ API ?¤ê? ?„ìš”?©ë‹ˆ?? ?¤ì •?ì„œ API ?¤ë? ?…ë ¥?´ì£¼?¸ìš”.")
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
        alert("TTSMaker?????´ìƒ ì§€?í•˜ì§€ ?ŠìŠµ?ˆë‹¤. SuperTone / ElevenLabs / ?€?…ìº?¤íŠ¸ / Supertonic??? íƒ?´ì£¼?¸ìš”.")
        setIsGeneratingTTS(false)
        return
      } else {
        // ElevenLabs (ê¸°ë³¸)
        const voiceId = (selectedVoiceId || "elevenlabs-jB1Cifc2UQbq1gR3wnb0").replace("elevenlabs-", "")
        const elevenlabsApiKey =
          typeof window !== "undefined"
            ? (localStorage.getItem("shotform_elevenlabs_api_key") || "").trim()
            : null

        if (!elevenlabsApiKey) {
          alert("ElevenLabs API ?¤ê? ?„ìš”?©ë‹ˆ?? ?¤ì •?ì„œ API ?¤ë? ?…ë ¥?´ì£¼?¸ìš”.")
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
        let errorMessage = "TTS ?ì„± ?¤íŒ¨"
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
      
      console.log("[Shopping] TTS API ?‘ë‹µ:", {
        hasAudioBase64: !!data.audioBase64,
        hasAudioUrl: !!data.audioUrl,
        success: data.success,
        error: data.error,
      })
      
      if (data.success === false) {
        throw new Error(data.error || "TTS ?ì„±???¤íŒ¨?ˆìŠµ?ˆë‹¤.")
      }
      
      if (!data.audioBase64 && !data.audioUrl) {
        throw new Error(`TTS ?‘ë‹µ???¤ë””???°ì´?°ê? ?†ìŠµ?ˆë‹¤. ?‘ë‹µ: ${JSON.stringify(data)}`)
      }

      // Base64ë¥?Blob?¼ë¡œ ë³€??      let audioBlob: Blob
      if (data.audioBase64) {
        const audioBytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0))
        audioBlob = new Blob([audioBytes], { type: "audio/mpeg" })
      } else if (data.audioUrl) {
        const audioResponse = await fetch(data.audioUrl)
        audioBlob = await audioResponse.blob()
      } else {
        throw new Error("?¤ë””???°ì´?°ë? ì°¾ì„ ???†ìŠµ?ˆë‹¤.")
      }

      // 1.5ë°°ì† ì²˜ë¦¬ (?¼ì¹˜ ? ì?)
      console.log("[Shopping] ?¤ë””??1.5ë°°ì† ì²˜ë¦¬ ?œì‘ (?¼ì¹˜ ? ì?)...")
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const arrayBuffer = await audioBlob.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      
      // ?ë³¸ ?¤ë””???•ë³´ ?•ì¸
      const originalDuration = audioBuffer.duration
      const originalSampleRate = audioBuffer.sampleRate
      const originalLength = audioBuffer.length
      
      console.log("[Shopping] ?ë³¸ ?¤ë””???•ë³´:", {
        ê¸¸ì´: originalDuration.toFixed(3) + "ì´?,
        ?˜í”Œ?? originalLength,
        ?˜í”Œ?ˆì´?? originalSampleRate + "Hz",
        ì±„ë„?? audioBuffer.numberOfChannels
      })
      
      // 1ë°°ì†?¼ë¡œ ?¬ìš© (ë°°ì† ì²˜ë¦¬ ?†ì´ ?ë³¸ ê·¸ë?ë¡??¬ìš©)
      // ?ë³¸ ?¤ë””?¤ë? ê·¸ë?ë¡?WAVë¡?ë³€?˜í•˜???„ì²´ ?€ë³¸ì´ ëª¨ë‘ ?¬í•¨?˜ë„ë¡???      console.log("[Shopping] ?¤ë””?¤ë? 1ë°°ì†?¼ë¡œ ì²˜ë¦¬ (?ë³¸ ê·¸ë?ë¡??¬ìš©, ?„ì²´ ?€ë³??¬í•¨)...")
      
      // WAVë¡?ë³€??(?ë³¸ ê·¸ë?ë¡??¬ìš©)
      console.log("[Shopping] WAV ë³€???œì‘...")
      const wavBuffer = audioBufferToWav(audioBuffer) // ?ë³¸ audioBuffer ?¬ìš©
      const processedBlob = new Blob([wavBuffer], { type: "audio/wav" })
      
      console.log("[Shopping] ???¤ë””??ì²˜ë¦¬ ?„ë£Œ (1ë°°ì†, ?ë³¸ ê·¸ë?ë¡? ?„ì²´ ?€ë³??¬í•¨)")
      console.log("[Shopping] WAV Blob ?¬ê¸°:", processedBlob.size, "bytes")
      console.log("[Shopping] ìµœì¢… ?¤ë””???•ë³´:", {
        ?ë³¸_ê¸¸ì´: originalDuration.toFixed(3) + "ì´?,
        ì²˜ë¦¬_??ê¸¸ì´: originalDuration.toFixed(3) + "ì´?(ë³€ê²??†ìŒ, ?„ì²´ ?€ë³??¬í•¨)",
        WAV_?¬ê¸°: (processedBlob.size / 1024).toFixed(2) + "KB"
      })
      
      // ?¤ì œ ?¤ë””??ê¸¸ì´ (?ë³¸ ê·¸ë?ë¡? ?¬ìš©
      const actualAudioDuration = originalDuration
      
      // ?„ì‹œ URL ?ì„± (ë¯¸ë¦¬?£ê¸°??
      const tempAudioUrl = URL.createObjectURL(processedBlob)
      console.log("[Shopping] ?„ì‹œ ?¤ë””??URL ?ì„±:", tempAudioUrl)
      
      // Supabase Storage???¤ë””???Œì¼ ?…ë¡œ??(?êµ¬ ?€??
      let permanentAudioUrl = tempAudioUrl // ê¸°ë³¸ê°? ?„ì‹œ URL
      try {
        if (userId && currentProject?.id) {
          console.log("[Shopping] ?¤ë””???Œì¼??Supabase Storage???…ë¡œ??ì¤?..")
          permanentAudioUrl = await uploadTTSAudio(processedBlob, currentProject.id, userId)
          console.log("[Shopping] ?¤ë””???Œì¼ ?…ë¡œ???„ë£Œ:", permanentAudioUrl)
        } else {
          console.warn("[Shopping] ?„ë¡œ?íŠ¸ê°€ ?†ì–´ ?¤ë””???Œì¼???…ë¡œ?œí•˜ì§€ ?ŠìŠµ?ˆë‹¤. ?„ë¡œ?íŠ¸ë¥?ë¨¼ì? ?€?¥í•´ì£¼ì„¸??")
        }
      } catch (uploadError) {
        console.error("[Shopping] ?¤ë””???Œì¼ ?…ë¡œ???¤íŒ¨:", uploadError)
        // ?…ë¡œ???¤íŒ¨?´ë„ ?„ì‹œ URL ?¬ìš© (?¬ìš©??ê²½í—˜ ? ì?)
      }
      
      // TTS ?¤ë””??URL ?¤ì • (?êµ¬ URL ?°ì„ , ?†ìœ¼ë©??„ì‹œ URL)
      setTtsAudioUrl(permanentAudioUrl)
      console.log("[Shopping] TTS ?¤ë””??URL ?¤ì • ?„ë£Œ:", permanentAudioUrl ? "?ˆìŒ" : "?†ìŒ")
      
      // ?¤ì œ ?¤ë””??ê¸¸ì´??ë§ì¶° scriptLines ?œê°„ ?•ë³´ ?ì„±/?¬ì¡°??      // 3ê°??¥ë©´?¼ë¡œ ?˜ëˆ„ê¸?(scenesê°€ ?†ìœ¼ë©??ì„±)
      let sceneTexts = scenes.length > 0 ? scenes : await splitScriptIntoScenes(script)
      if (scenes.length === 0) {
        setScenes(sceneTexts)
      }
      
      // ê°??¥ë©´??ë¬¸ì¥ ?¨ìœ„ë¡??˜ëˆ„??scriptLines ?ì„±
      const lines: ScriptLine[] = []
      let currentTime = 0
      
      // ?¤ì œ ?¤ë””??ê¸¸ì´??ë§ì¶° ?œê°„ ë¶„ë°°
      const totalCharacters = script.length
      
      for (let i = 0; i < sceneTexts.length; i++) {
        const scene = sceneTexts[i]
        const sentences = scene.split(/[.!??‚ï¼ï¼?\s*/).filter(s => s.trim().length > 0)
        
        for (const sentence of sentences) {
          const sentenceLength = sentence.trim().length
          const duration = (sentenceLength / totalCharacters) * actualAudioDuration * 1000 // ë°€ë¦¬ì´ˆ
          
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
      console.log("[Shopping] scriptLines ?œê°„ ?•ë³´ ?ì„± ?„ë£Œ (?¤ì œ ?¤ë””??ê¸¸ì´ ê¸°ë°˜)")
      
      setTtsProgress({ current: 1, total: 1 })
      
      alert(`TTS ?ì„±???„ë£Œ?˜ì—ˆ?µë‹ˆ?? (?¤ì œ ê¸¸ì´: ${actualAudioDuration.toFixed(1)}ì´?`)
    } catch (error) {
      console.error("TTS ?ì„± ?¤íŒ¨:", error)
      setError(`TTS ?ì„±???¤íŒ¨?ˆìŠµ?ˆë‹¤: ${error instanceof Error ? error.message : "?????†ëŠ” ?¤ë¥˜"}`)
    } finally {
      setIsGeneratingTTS(false)
    }
  }

  // ?´ë?ì§€ 1ê°œë§Œ ?ì„± (?ìƒ?€ ë¯¸ë¦¬ë³´ê¸° ë²„íŠ¼?ì„œ)
  // ?´ë?ì§€ ?ì„± ?¨ê³„ë¡??´ë™ (?¤ì œ ?ì„±?€ ?˜ì? ?ŠìŒ)
  const handleGoToImageGeneration = () => {
    if (!script.trim()) {
      alert("?€ë³¸ì´ ?ì„±?˜ì? ?Šì•˜?µë‹ˆ??")
      return
    }
    setActiveStep("video")
    // ?„ë¡¬?„íŠ¸ ì´ˆê¸°??    setImagePrompts([])
    setPromptsGenerated(false)
    // ?ìƒ ?ì„± ?íƒœ ì´ˆê¸°??(?¨ê³„ ?„í™˜ ??
    setIsConvertingToVideo(new Map())
  }

  // ?´ë?ì§€ ?„ë¡¬?„íŠ¸ ?ì„± ?¨ìˆ˜
  const handleGenerateImagePrompts = async () => {
    if (!script.trim()) {
      alert("?€ë³¸ì´ ?ì„±?˜ì? ?Šì•˜?µë‹ˆ??")
      return
    }

    const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined

    if (!openaiApiKey) {
      alert("OpenAI API ?¤ê? ?„ìš”?©ë‹ˆ?? ë©”ì¸ ?”ë©´???¤ì •(?±ë‹ˆë°”í€??„ì´ì½??ì„œ API ?¤ë? ?…ë ¥?´ì£¼?¸ìš”.")
      return
    }

    setIsGeneratingPrompts(true)
    setError("")

    try {
      // ?´ë?ì§€ë¥?base64ë¡?ë³€??(?ˆëŠ” ê²½ìš°)
      let imageBase64: string | undefined = undefined
      if (productImage) {
        imageBase64 = productImage
      }

      // ?€ë³??„ì²´ë¥?ë¶„ì„?˜ì—¬ ?´ë?ì§€ ?„ë¡¬?„íŠ¸ ?ì„± (1ê°??´ë?ì§€??
      const prompts = await generateImagePromptsFromScript(
        script, // ?€ë³??„ì²´ ?„ë‹¬
        productName,
        productDescription || "",
        imageBase64,
        openaiApiKey,
        animalCharacter
      )
      
      setImagePrompts(prompts)
      setPromptsGenerated(true)
    } catch (error) {
      console.error("?„ë¡¬?„íŠ¸ ?ì„± ?¤íŒ¨:", error)
      setError(`?„ë¡¬?„íŠ¸ ?ì„±???¤íŒ¨?ˆìŠµ?ˆë‹¤: ${error instanceof Error ? error.message : "?????†ëŠ” ?¤ë¥˜"}`)
    } finally {
      setIsGeneratingPrompts(false)
    }
  }

  // ?¤ì œ ?´ë?ì§€ ?ì„± ?¨ìˆ˜ (?„ë¡¬?„íŠ¸ ?¬ìš©)
  const handleGenerateImage = async () => {
    if (!script.trim()) {
      alert("?€ë³¸ì´ ?ì„±?˜ì? ?Šì•˜?µë‹ˆ??")
      return
    }

    if (!promptsGenerated || imagePrompts.length === 0) {
      alert("ë¨¼ì? ?´ë?ì§€ ?„ë¡¬?„íŠ¸ë¥??ì„±?´ì£¼?¸ìš”.")
      return
    }

    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined

    if (!replicateApiKey) {
      alert("Replicate API ?¤ê? ?„ìš”?©ë‹ˆ?? ë©”ì¸ ?”ë©´???¤ì •(?±ë‹ˆë°”í€??„ì´ì½??ì„œ API ?¤ë? ?…ë ¥?´ì£¼?¸ìš”.")
      return
    }

    setIsGeneratingVideo(true)
    setError("")
    setImageUrls([]) // ?¬ìƒ????ê¸°ì¡´ ?´ë?ì§€ ì´ˆê¸°??    setGenerationProgress({ current: 0, total: 3 })

    try {
      // ?´ë?ì§€ë¥?base64ë¡?ë³€??(?ˆëŠ” ê²½ìš°)
      let imageBase64: string | undefined = undefined
      let imageAspectRatio: string | undefined = undefined
      
      if (productImage) {
        imageBase64 = productImage
        
        // ?ë³¸ ?´ë?ì§€ ë¹„ìœ¨ ê³„ì‚°
        try {
          const img = new Image()
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              const width = img.width
              const height = img.height
              const ratio = width / height
              
              // ë¹„ìœ¨???°ë¼ ?ì ˆ??aspect_ratio ?¤ì •
              if (Math.abs(ratio - 1) < 0.1) {
                // 1:1 (?•ì‚¬ê°í˜•)
                imageAspectRatio = "1:1"
              } else if (ratio > 1.2) {
                // ê°€ë¡œê? ??ê¸?ê²½ìš°
                imageAspectRatio = "16:9"
              } else if (ratio < 0.7) {
                // ?¸ë¡œê°€ ??ê¸?ê²½ìš°
                imageAspectRatio = "9:16"
              } else {
                // ì¤‘ê°„ ë¹„ìœ¨
                imageAspectRatio = ratio > 1 ? "4:3" : "3:4"
              }
              console.log(`[Shopping] ?ë³¸ ?´ë?ì§€ ë¹„ìœ¨ ê³„ì‚°: ${width}x${height} = ${ratio.toFixed(2)}, aspect_ratio: ${imageAspectRatio}`)
              resolve()
            }
            img.onerror = () => {
              console.warn("[Shopping] ?´ë?ì§€ ë¹„ìœ¨ ê³„ì‚° ?¤íŒ¨, ê¸°ë³¸ê°?9:16 ?¬ìš©")
              imageAspectRatio = "9:16"
              resolve()
            }
            img.src = productImage
          })
        } catch (error) {
          console.error("[Shopping] ?´ë?ì§€ ë¹„ìœ¨ ê³„ì‚° ì¤??¤ë¥˜:", error)
          imageAspectRatio = "9:16" // ê¸°ë³¸ê°?        }
      }

      // ?„ë¡¬?„íŠ¸ë¥??¬ìš©?˜ì—¬ 3?¥ì˜ ?´ë?ì§€ ?ì„±
      const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined
      
      const imageUrls = await generateImage(script, productName, replicateApiKey, imageBase64, productDescription, openaiApiKey, imagePrompts, imageAspectRatio, animalCharacter)
      
      setImageUrls(imageUrls)
      setGenerationProgress({ current: 3, total: 3 })
      // ?´ë?ì§€ ?ì„± ?„ë£Œ ?„ì—??"video" ?¨ê³„??ë¨¸ë¬¼?¬ì„œ ?ë³¸ê³??ì„±???´ë?ì§€ë¥?ë¹„êµ?????ˆë„ë¡???    } catch (error) {
      console.error("?´ë?ì§€ ?ì„± ?¤íŒ¨:", error)
      setError(`?´ë?ì§€ ?ì„±???¤íŒ¨?ˆìŠµ?ˆë‹¤: ${error instanceof Error ? error.message : "?????†ëŠ” ?¤ë¥˜"}`)
    } finally {
      setIsGeneratingVideo(false)
      setGenerationProgress({ current: 0, total: 1 })
    }
  }

  // ê°œë³„ ?´ë?ì§€ ?¬ìƒ???¨ìˆ˜
  const handleRegenerateSingleImage = async (index: 0 | 1 | 2) => {
    // ì¦‰ì‹œ ë¡œë”© ?íƒœ ?¤ì • (ë²„íŠ¼ ?´ë¦­ ??ë°”ë¡œ ë¡œë”© ?œì‹œ)
    setIsRegeneratingImage((prev) => {
      const newMap = new Map(prev)
      newMap.set(index, true)
      return newMap
    })
    
    if (!script.trim()) {
      alert("?€ë³¸ì´ ?ì„±?˜ì? ?Šì•˜?µë‹ˆ??")
      setIsRegeneratingImage((prev) => {
        const newMap = new Map(prev)
        newMap.set(index, false)
        return newMap
      })
      return
    }

    if (!promptsGenerated || imagePrompts.length === 0) {
      alert("ë¨¼ì? ?´ë?ì§€ ?„ë¡¬?„íŠ¸ë¥??ì„±?´ì£¼?¸ìš”.")
      setIsRegeneratingImage((prev) => {
        const newMap = new Map(prev)
        newMap.set(index, false)
        return newMap
      })
      return
    }

    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined

    if (!replicateApiKey) {
      alert("Replicate API ?¤ê? ?„ìš”?©ë‹ˆ?? ë©”ì¸ ?”ë©´???¤ì •(?±ë‹ˆë°”í€??„ì´ì½??ì„œ API ?¤ë? ?…ë ¥?´ì£¼?¸ìš”.")
      setIsRegeneratingImage((prev) => {
        const newMap = new Map(prev)
        newMap.set(index, false)
        return newMap
      })
      return
    }

    const sceneNames = ["?œí’ˆ ?„ì²´ ??, "?œí’ˆ ?”í…Œ????, "?¤ë¥¸ ë°°ê²½ ??]
    
    try {
      setError("")
      
      console.log(`[Shopping] ?–¼ï¸?${sceneNames[index]} ?¬ìƒ???œì‘`)
      
      // ?´ë?ì§€ë¥?base64ë¡?ë³€??(?ˆëŠ” ê²½ìš°)
      let imageBase64: string | undefined = undefined
      let imageAspectRatio: string | undefined = undefined
      
      if (productImage) {
        imageBase64 = productImage
        
        // ?ë³¸ ?´ë?ì§€ ë¹„ìœ¨ ê³„ì‚°
        try {
          const img = new Image()
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              const width = img.width
              const height = img.height
              const ratio = width / height
              
              // ë¹„ìœ¨???°ë¼ ?ì ˆ??aspect_ratio ?¤ì •
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
          console.error("[Shopping] ?´ë?ì§€ ë¹„ìœ¨ ê³„ì‚° ì¤??¤ë¥˜:", error)
          imageAspectRatio = "9:16"
        }
      }

      // ?´ë‹¹ ?¸ë±?¤ì˜ ?„ë¡¬?„íŠ¸ë¡??´ë?ì§€ ?¬ìƒ??      const prompt = imagePrompts[index]
      
      // ì¶”ê? ?„ë¡¬?„íŠ¸ê°€ ?ˆìœ¼ë©?AIë¥??µí•´ ?„ë¡¬?„íŠ¸ ?¬ì‘??      const customPrompt = customImagePrompts.get(index)
      let finalPrompt = prompt.prompt
      
      if (customPrompt && customPrompt.trim()) {
        console.log(`[Shopping] ì¶”ê? ?„ë¡¬?„íŠ¸ ê°ì?, AIë¥??µí•´ ?„ë¡¬?„íŠ¸ ?¬ì‘???œì‘: ${customPrompt}`)
        
        const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined
        
        if (openaiApiKey) {
          // AIë¥??µí•´ ?„ë¡¬?„íŠ¸ ?¬ì‘??          finalPrompt = await refineImagePromptWithCustomInput(
            prompt.prompt,
            customPrompt,
            productName,
            productDescription,
            openaiApiKey
          )
          console.log(`[Shopping] ??AIê°€ ?¬ì‘?±í•œ ?„ë¡¬?„íŠ¸: ${finalPrompt.substring(0, 100)}...`)
        } else {
          // API ?¤ê? ?†ìœ¼ë©??¨ìˆœ???°ê²°
          finalPrompt = `${prompt.prompt}, ${customPrompt.trim()}`
          console.log(`[Shopping] OpenAI API ???†ìŒ, ?¨ìˆœ ?°ê²° ?¬ìš©`)
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
      
      console.log(`[Shopping] ??${sceneNames[index]} ?¬ìƒ???„ë£Œ:`, imageUrl)
      
      // ?¬ìƒ?±ëœ ?´ë?ì§€ URL ?…ë°?´íŠ¸
      setImageUrls((prev) => {
        const newUrls = [...prev]
        newUrls[index] = imageUrl
        return newUrls
      })
      
      // ?´ë‹¹ ?¸ë±?¤ì˜ ?ìƒ???ˆë‹¤ë©?ì´ˆê¸°??(?´ë?ì§€ê°€ ë³€ê²½ë˜?ˆìœ¼ë¯€ë¡?
      setConvertedVideoUrls((prev) => {
        const newMap = new Map(prev)
        newMap.delete(index)
        return newMap
      })
      
    } catch (error) {
      console.error(`[Shopping] ??${sceneNames[index]} ?¬ìƒ???¤íŒ¨:`, error)
      setError(`?´ë?ì§€ ?¬ìƒ?±ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤: ${error instanceof Error ? error.message : "?????†ëŠ” ?¤ë¥˜"}`)
    } finally {
      // ?íƒœ ?…ë°?´íŠ¸
      setIsRegeneratingImage((prev) => {
        const newMap = new Map(prev)
        newMap.set(index, false)
        return newMap
      })
    }
  }

  // ë¯¸ë¦¬ë³´ê¸° ë²„íŠ¼ ?´ë¦­ ???ìƒ ?ì„± ë°?ë¯¸ë¦¬ë³´ê¸° ì¤€ë¹?(?ˆê±°??- ?¬ìš© ????
  const handleGenerateVideoFromImage = async () => {
    // ???¨ìˆ˜?????´ìƒ ?¬ìš©?˜ì? ?ŠìŒ
    // handleConvertAllImagesToVideosë¥??¬ìš©?´ì•¼ ??    alert("?´ë?ì§€ ?ìƒ ë³€??ê¸°ëŠ¥???¬ìš©?´ì£¼?¸ìš”.")
  }

  // ë¯¸ë¦¬ë³´ê¸° ì´ˆê¸°??(?ì„±???ìƒ + TTS + ?ë§‰)
  const initializePreview = async (generatedVideoUrl: string) => {
    if (!ttsAudioUrl || !canvasRef.current) {
      console.warn("TTS ?ëŠ” ìº”ë²„?¤ê? ì¤€ë¹„ë˜ì§€ ?Šì•˜?µë‹ˆ??")
      return
    }

    try {
      // ?¤ë””??ë¡œë“œ
      const audio = new Audio(ttsAudioUrl)
      audio.crossOrigin = "anonymous"
      
      await new Promise<void>((resolve, reject) => {
        audio.oncanplaythrough = () => resolve()
        audio.onerror = (e) => reject(e)
        audio.load()
      })
      
      setPreviewAudio(audio)
      
      // ë¹„ë””??ë¡œë“œ
      const video = document.createElement("video")
      video.src = generatedVideoUrl
      video.crossOrigin = "anonymous"
      video.preload = "auto"
      video.muted = true // ?Œì†Œê±?(TTSë¥?ë³„ë„ë¡??¬ìƒ)
      video.loop = true // ë£¨í”„ (TTS ê¸¸ì´??ë§ì¶° ë°˜ë³µ)
      
      await new Promise<void>((resolve, reject) => {
        video.oncanplaythrough = () => resolve()
        video.onerror = (e) => reject(e)
        video.load()
      })
      
      setPreviewVideoElements([video])
      
      // ìº”ë²„?¤ì— ì²??„ë ˆ??ê·¸ë¦¬ê¸?(ë¹„ìœ¨ ? ì?)
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
          
          // ë¹„ë””?¤ì? ìº”ë²„?¤ì˜ ë¹„ìœ¨ ê³„ì‚°
          const videoAspect = videoWidth / videoHeight
          const canvasAspect = canvasWidth / canvasHeight
          
          let drawWidth = canvasWidth
          let drawHeight = canvasHeight
          let drawX = 0
          let drawY = 0
          
          // ë¹„ìœ¨??ë§ì¶° ì¤‘ì•™ ?¬ë¡­ (cover ë°©ì‹)
          if (videoAspect > canvasAspect) {
            // ë¹„ë””?¤ê? ???“ìŒ - ?’ì´??ë§ì¶”ê³?ì¢Œìš° ?¬ë¡­
            drawHeight = canvasHeight
            drawWidth = drawHeight * videoAspect
            drawX = (canvasWidth - drawWidth) / 2
          } else {
            // ë¹„ë””?¤ê? ???’ìŒ - ?ˆë¹„??ë§ì¶”ê³??í•˜ ?¬ë¡­
            drawWidth = canvasWidth
            drawHeight = drawWidth / videoAspect
            drawY = (canvasHeight - drawHeight) / 2
          }
          
          ctx.drawImage(video, 0, 0, videoWidth, videoHeight, drawX, drawY, drawWidth, drawHeight)
        }
      }
      
      console.log("[Shopping] ë¯¸ë¦¬ë³´ê¸° ì¤€ë¹??„ë£Œ")
    } catch (error) {
      console.error("[Shopping] ë¯¸ë¦¬ë³´ê¸° ì¤€ë¹??¤íŒ¨:", error)
      setError(`ë¯¸ë¦¬ë³´ê¸° ì¤€ë¹„ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤: ${error instanceof Error ? error.message : "?????†ëŠ” ?¤ë¥˜"}`)
    }
  }

  // ?¸ë„¤???ì„± (AI)
  const handleGenerateThumbnail = async () => {
    if (!productName) {
      alert("?œí’ˆëª…ì´ ?„ìš”?©ë‹ˆ??")
      return
    }

    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined
    const gptApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined

    if (!replicateApiKey) {
      alert("Replicate API ?¤ê? ?„ìš”?©ë‹ˆ?? ë©”ì¸ ?”ë©´???¤ì •(?±ë‹ˆë°”í€??„ì´ì½??ì„œ API ?¤ë? ?…ë ¥?´ì£¼?¸ìš”.")
      return
    }

    setIsGeneratingThumbnail(true)
    setError("")

    try {
      // ?œí’ˆ ?´ë?ì§€ê°€ ?ˆìœ¼ë©?base64ë¡?ë³€??      let imageBase64: string | undefined = undefined
      if (productImage) {
        imageBase64 = productImage
      }

      // 1. ?„í‚¹ ë¬¸êµ¬ ?ì„±
      const hookingText = await generateThumbnailHookingText(productName, gptApiKey)
      setThumbnailHookingText(hookingText)

      // 2. ?œí’ˆ ?´ë?ì§€ ?•ì¸
      if (!imageBase64) {
        throw new Error("?œí’ˆ ?´ë?ì§€ê°€ ?„ìš”?©ë‹ˆ??")
      }

      // 3. ?˜ë…¸ë°”ë‚˜?˜ë¡œ ?¸ë„¤???ì„± (?œí’ˆ ?´ë?ì§€ + ?ìŠ¤???¬í•¨)
      const thumbnail = await generateShortsThumbnail(productName, replicateApiKey, imageBase64, hookingText)
      
      // 4. ?¸ë„¤??ëª©ë¡??ì¶”ê?
      const newThumbnail = {
        url: thumbnail,
        text: hookingText,
        isCustom: false
      }
      setThumbnailImages(prev => [...prev, newThumbnail])
      setSelectedThumbnailIndex(thumbnailImages.length)
      setThumbnailUrl(thumbnail)

      // 5. ?ì„±???¸ë„¤?¼ì„ ìº”ë²„?¤ì— ?œì‹œ (AI ?ì„± ?¸ë„¤?¼ì? ?´ë? ?ìŠ¤?¸ê? ?¬í•¨?˜ì–´ ?ˆìœ¼ë¯€ë¡?ê·¸ë?ë¡??œì‹œ)
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
              // ë¹„ìœ¨ ? ì??˜ë©° ê·¸ë¦¬ê¸?              const imgAspect = img.width / img.height
              const canvasAspect = canvas.width / canvas.height
              
              let drawWidth: number
              let drawHeight: number
              let offsetX: number
              let offsetY: number
              
              if (imgAspect > canvasAspect) {
                // ?´ë?ì§€ê°€ ???“ìŒ - ?’ì´??ë§ì¶”ê³?ì¢Œìš° ?¬ë¡­
                drawHeight = canvas.height
                drawWidth = drawHeight * imgAspect
                offsetX = (canvas.width - drawWidth) / 2
                offsetY = 0
              } else {
                // ?´ë?ì§€ê°€ ???’ìŒ - ?ˆë¹„??ë§ì¶”ê³??í•˜ ?¬ë¡­
                drawWidth = canvas.width
                drawHeight = drawWidth / imgAspect
                offsetX = 0
                offsetY = (canvas.height - drawHeight) / 2
              }
              
              // ê²€?€ ë°°ê²½?¼ë¡œ ì±„ìš°ê¸?              ctx.fillStyle = "black"
              ctx.fillRect(0, 0, canvas.width, canvas.height)
              
              // ?´ë?ì§€ ê·¸ë¦¬ê¸?(ë¹„ìœ¨ ? ì?)
              ctx.drawImage(img, 0, 0, img.width, img.height, offsetX, offsetY, drawWidth, drawHeight)
            }
          }
        }
      }, 100)
    } catch (error) {
      console.error("?¸ë„¤???ì„± ?¤íŒ¨:", error)
      setError(`?¸ë„¤???ì„±???¤íŒ¨?ˆìŠµ?ˆë‹¤: ${error instanceof Error ? error.message : "?????†ëŠ” ?¤ë¥˜"}`)
    } finally {
      setIsGeneratingThumbnail(false)
    }
  }

  // ì§ì ‘ ?¸ë„¤???´ë?ì§€ ?…ë¡œ??  const handleCustomThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      alert("?´ë?ì§€ ?Œì¼ë§??…ë¡œ??ê°€?¥í•©?ˆë‹¤.")
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string
      setCustomThumbnailImage(imageUrl)
      
      // ?„í‚¹ ë¬¸êµ¬ ?ë™ ?ì„± (? íƒ?¬í•­)
      if (!customThumbnailText.line1) {
        const gptApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined
        if (gptApiKey) {
          generateThumbnailHookingText(productName, gptApiKey).then(text => {
            setCustomThumbnailText(text)
          }).catch(() => {
            // ?¤íŒ¨?´ë„ ê³„ì† ì§„í–‰
          })
        }
      }
    }
    reader.readAsDataURL(file)
  }

  // ?´ë?ì§€ ?ì„± ?¨ê³„?ì„œ ?ì„±???´ë?ì§€ ? íƒ
  const handleSelectGeneratedImage = (imageUrl: string) => {
    setCustomThumbnailImage(imageUrl)
    
    // ?„í‚¹ ë¬¸êµ¬ ?ë™ ?ì„± (? íƒ?¬í•­)
    if (!customThumbnailText.line1) {
      const gptApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined
      if (gptApiKey) {
        generateThumbnailHookingText(productName, gptApiKey).then(text => {
          setCustomThumbnailText(text)
        }).catch(() => {
          // ?¤íŒ¨?´ë„ ê³„ì† ì§„í–‰
        })
      }
    }
  }

  // ì§ì ‘ ?ì„±???¸ë„¤?¼ì— ?ìŠ¤??ì¶”ê? ë°??€??  const handleSaveCustomThumbnail = () => {
    if (!customThumbnailImage) {
      alert("?´ë?ì§€ë¥??…ë¡œ?œí•´ì£¼ì„¸??")
      return
    }

    if (!customThumbnailText.line1 || !customThumbnailText.line2) {
      alert("?ìŠ¤?¸ë? ?…ë ¥?´ì£¼?¸ìš”.")
      return
    }

    // ìº”ë²„?¤ì— ?´ë?ì§€?€ ?ìŠ¤??ê·¸ë¦¬ê¸?    renderThumbnailWithText(customThumbnailImage, customThumbnailText).then(() => {
      // ìº”ë²„?¤ì—???°ì´??URL ê°€?¸ì˜¤ê¸?      if (thumbnailCanvasRef.current) {
        const dataUrl = thumbnailCanvasRef.current.toDataURL("image/png")
        
        // ?¸ë„¤??ëª©ë¡??ì¶”ê?
        const newThumbnail = {
          url: dataUrl,
          text: customThumbnailText,
          isCustom: true
        }
        setThumbnailImages(prev => [...prev, newThumbnail])
        setSelectedThumbnailIndex(thumbnailImages.length)
        setThumbnailUrl(dataUrl)
        
        // ì´ˆê¸°??        setCustomThumbnailImage("")
        setCustomThumbnailText({ line1: "", line2: "" })
      }
    })
  }

  // ?¸ë„¤??? íƒ
  const handleSelectThumbnail = (index: number) => {
    setSelectedThumbnailIndex(index)
    const selected = thumbnailImages[index]
    if (selected) {
      setThumbnailUrl(selected.url)
      setThumbnailHookingText(selected.text)
      
      // AI ?ì„± ?¸ë„¤?¼ì? ?´ë? ?ìŠ¤?¸ê? ?¬í•¨?˜ì–´ ?ˆìœ¼ë¯€ë¡?ê·¸ë?ë¡??œì‹œ
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
              // ë¹„ìœ¨ ? ì??˜ë©° ê·¸ë¦¬ê¸?              const imgAspect = img.width / img.height
              const canvasAspect = canvas.width / canvas.height
              
              let drawWidth: number
              let drawHeight: number
              let offsetX: number
              let offsetY: number
              
              if (imgAspect > canvasAspect) {
                // ?´ë?ì§€ê°€ ???“ìŒ - ?’ì´??ë§ì¶”ê³?ì¢Œìš° ?¬ë¡­
                drawHeight = canvas.height
                drawWidth = drawHeight * imgAspect
                offsetX = (canvas.width - drawWidth) / 2
                offsetY = 0
              } else {
                // ?´ë?ì§€ê°€ ???’ìŒ - ?ˆë¹„??ë§ì¶”ê³??í•˜ ?¬ë¡­
                drawWidth = canvas.width
                drawHeight = drawWidth / imgAspect
                offsetX = 0
                offsetY = (canvas.height - drawHeight) / 2
              }
              
              // ê²€?€ ë°°ê²½?¼ë¡œ ì±„ìš°ê¸?              ctx.fillStyle = "black"
              ctx.fillRect(0, 0, canvas.width, canvas.height)
              
              // ?´ë?ì§€ ê·¸ë¦¬ê¸?(ë¹„ìœ¨ ? ì?)
              ctx.drawImage(img, 0, 0, img.width, img.height, offsetX, offsetY, drawWidth, drawHeight)
            }
          }
        }
      } else {
        // ì§ì ‘ ?ì„± ?¸ë„¤?¼ì? ?ìŠ¤?¸ë? ?Œë”ë§?        renderThumbnailWithText(selected.url, selected.text)
      }
    }
  }

  // ?¸ë„¤?¼ì— ?ìŠ¤???Œë”ë§?  const renderThumbnailWithText = async (imageUrl: string, hookingText: { line1: string; line2: string }): Promise<void> => {
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

      // ìº”ë²„???¬ê¸° ?¤ì • (9:16 ë¹„ìœ¨)
      canvas.width = 1080
      canvas.height = 1920

      // ?´ë?ì§€ ë¡œë“œ
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.src = imageUrl

      img.onload = () => {
        // ë°°ê²½ ?´ë?ì§€ ê·¸ë¦¬ê¸?(ë¹„ìœ¨ ? ì??˜ë©° ?•ë? - cover ë°©ì‹)
        const imgAspect = img.width / img.height
        const canvasAspect = canvas.width / canvas.height
        
        // ?´ë?ì§€ ?¤ì????ìš©
        let drawWidth: number
        let drawHeight: number
        let offsetX: number
        let offsetY: number
        
        // ë¹„ìœ¨??? ì??˜ë©´???•ë? (cover ë°©ì‹)
        if (imgAspect > canvasAspect) {
          // ?´ë?ì§€ê°€ ???“ìŒ - ?’ì´??ë§ì¶”ê³?ì¢Œìš° ?¬ë¡­
          drawHeight = canvas.height * customThumbnailTextStyle.imageScale
          drawWidth = drawHeight * imgAspect
          offsetX = (canvas.width - drawWidth) / 2
          offsetY = (canvas.height - drawHeight) / 2
        } else {
          // ?´ë?ì§€ê°€ ???’ìŒ - ?ˆë¹„??ë§ì¶”ê³??í•˜ ?¬ë¡­
          drawWidth = canvas.width * customThumbnailTextStyle.imageScale
          drawHeight = drawWidth / imgAspect
          offsetX = (canvas.width - drawWidth) / 2
          offsetY = (canvas.height - drawHeight) / 2
        }
        
        // ê²€?€ ë°°ê²½?¼ë¡œ ì±„ìš°ê¸?        ctx.fillStyle = "black"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        // ?´ë?ì§€ ê·¸ë¦¬ê¸?(ë¹„ìœ¨ ? ì?)
        ctx.drawImage(img, 0, 0, img.width, img.height, offsetX, offsetY, drawWidth, drawHeight)

        // ?ìŠ¤???„ì¹˜ (?¬ìš©???¤ì •???°ë¼)
        const textY = canvas.height * customThumbnailTextStyle.position
        const textX = canvas.width / 2

        // ì²?ë²ˆì§¸ ì¤??¤í???(ê¸€???¬ê¸°: customThumbnailTextStyle.fontSize)
        const fontSize = customThumbnailTextStyle.fontSize ?? 100
        ctx.font = `bold ${fontSize}px 'Noto Sans KR', Arial, sans-serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        
        // ì²?ë²ˆì§¸ ì¤??Œì „ ?ìš©
        ctx.save()
        ctx.translate(textX, textY)
        ctx.rotate((customThumbnailTextStyle.textRotation * Math.PI) / 180)
        
        // ì²?ë²ˆì§¸ ì¤??Œë‘ë¦?        if (customThumbnailTextStyle.strokeWidth > 0) {
          ctx.strokeStyle = customThumbnailTextStyle.strokeColor
          ctx.lineWidth = customThumbnailTextStyle.strokeWidth
          ctx.lineJoin = "round"
          ctx.strokeText(hookingText.line1, 0, 0)
        }
        
        // ì²?ë²ˆì§¸ ì¤??ìŠ¤??        ctx.fillStyle = customThumbnailTextStyle.line1Color
        ctx.fillText(hookingText.line1, 0, 0)
        ctx.restore()

        // ??ë²ˆì§¸ ì¤??¤í???(ì²?ì¤„ê³¼ ?™ì¼ ?¬ê¸°, ì¤?ê°„ê²©?€ ê¸€???¬ê¸°??1.2ë°?
        const textY2 = textY + fontSize * 1.2
        
        // ??ë²ˆì§¸ ì¤??Œì „ ?ìš©
        ctx.save()
        ctx.translate(textX, textY2)
        ctx.rotate((customThumbnailTextStyle.textRotation * Math.PI) / 180)
        
        // ??ë²ˆì§¸ ì¤??Œë‘ë¦?        if (customThumbnailTextStyle.strokeWidth > 0) {
          ctx.strokeStyle = customThumbnailTextStyle.strokeColor
          ctx.lineWidth = customThumbnailTextStyle.strokeWidth
          ctx.strokeText(hookingText.line2, 0, 0)
        }
        
        // ??ë²ˆì§¸ ì¤??ìŠ¤??        ctx.fillStyle = customThumbnailTextStyle.line2Color
        ctx.fillText(hookingText.line2, 0, 0)
        ctx.restore()
        
        resolve()
      }

      img.onerror = () => {
        resolve()
      }
    })
  }

  // ?¸ë„¤???¤ìš´ë¡œë“œ (ìº”ë²„?¤ì—??
  const handleDownloadThumbnail = () => {
    const canvas = thumbnailCanvasRef.current
    if (!canvas) {
      alert("?¸ë„¤?¼ì´ ?ì„±?˜ì? ?Šì•˜?µë‹ˆ??")
      return
    }
    
    try {
      const dataUrl = canvas.toDataURL("image/png")
      const a = document.createElement("a")
      a.href = dataUrl
      a.download = `${productName}_?¼ì¸ _?¸ë„¤??png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (error) {
      console.error("?¸ë„¤???¤ìš´ë¡œë“œ ?¤íŒ¨:", error)
      alert("?¸ë„¤???¤ìš´ë¡œë“œ???¤íŒ¨?ˆìŠµ?ˆë‹¤.")
    }
  }

  // ë¯¸ë¦¬ë³´ê¸° ì´ˆê¸°??ë°??¬ìƒ
  const handlePreview = async () => {
    // Map??ë°°ì—´ë¡?ë³€??(?¸ë±???œì„œ?€ë¡?
    const videoUrlsArray: string[] = []
    for (let i = 0; i < imageUrls.length; i++) {
      const videoUrl = convertedVideoUrls.get(i)
      if (!videoUrl) {
        alert(`?¥ë©´ ${i + 1}???ìƒ???„ì§ ë³€?˜ë˜ì§€ ?Šì•˜?µë‹ˆ??`)
        return
      }
      videoUrlsArray.push(videoUrl)
    }

    if (videoUrlsArray.length === 0 || !ttsAudioUrl || !canvasRef.current) {
      alert("ë³€?˜ëœ ?ìƒê³?TTSê°€ ëª¨ë‘ ì¤€ë¹„ë˜?´ì•¼ ?©ë‹ˆ??")
      return
    }

    setError("")
    try {
      console.log("[Shopping] ë¯¸ë¦¬ë³´ê¸° ?œì‘")

      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        throw new Error("Canvas contextë¥??ì„±?????†ìŠµ?ˆë‹¤.")
      }

      // Canvas ?¬ê¸°ë¥?1080x1920?¼ë¡œ ?¤ì •
      canvas.width = 1080
      canvas.height = 1920

      // ?´ë? ë¡œë“œ???¤ë””?¤ì? ë¹„ë””?¤ê? ?ˆìœ¼ë©??¬ì‚¬??      let audio: HTMLAudioElement | null = previewAudio
      let bgmAudio: HTMLAudioElement | null = null
      let videoElements = previewVideoElements

      // ?¤ë””?¤ê? ?†ê±°??? íš¨?˜ì? ?Šìœ¼ë©??ˆë¡œ ë¡œë“œ
      if (!audio || !audio.duration || isNaN(audio.duration)) {
        console.log("[Shopping] ?¤ë””???ˆë¡œ ë¡œë“œ")
        const audioResponse = await fetch(ttsAudioUrl)
        const audioBlob = await audioResponse.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        audio = new Audio(audioUrl)
        audio.volume = ttsVolume // TTS ë³¼ë¥¨ ?¤ì •

        await new Promise<void>((resolve, reject) => {
          if (!audio) {
            reject(new Error("?¤ë””???ì„± ?¤íŒ¨"))
            return
          }
          audio.onloadeddata = () => resolve()
          audio.onerror = reject
        })
        setPreviewAudio(audio)
      } else {
        console.log("[Shopping] ê¸°ì¡´ ?¤ë””???¬ì‚¬??)
        // ê¸°ì¡´ ?¤ë””???¬ì‚¬?????œê°„ ì´ˆê¸°??ë°?ë³¼ë¥¨ ?¤ì •
        audio.currentTime = 0
        audio.pause()
        audio.volume = ttsVolume
      }

      if (!audio) {
        throw new Error("?¤ë””?¤ë? ë¡œë“œ?????†ìŠµ?ˆë‹¤.")
      }

      // BGM ë¡œë“œ (?ˆëŠ” ê²½ìš°)
      let sfxAudio: HTMLAudioElement | null = null
      if (bgmUrl) {
        // ?ˆë¡œ??BGM??ë§Œë“¤ê¸??„ì— ?´ì „ BGM ?•ë¦¬
        if (previewBgmAudio) {
          console.log("[Shopping] ?´ì „ BGM ?•ë¦¬")
          previewBgmAudio.pause()
          previewBgmAudio.currentTime = 0
          previewBgmAudio.src = "" // ?¤ë””???ŒìŠ¤ ?œê±°
          previewBgmAudio.load() // ?¤ë””??ë¦¬ì†Œ???´ì œ
          setPreviewBgmAudio(null)
        }
        
        console.log("[Shopping] BGM ë¡œë“œ")
        bgmAudio = new Audio(bgmUrl)
        bgmAudio.volume = bgmVolume
        bgmAudio.loop = false // ?œê°„?€??ë§ê²Œ ?¬ìƒ?˜ë?ë¡?loop ?´ì œ
        
        await new Promise<void>((resolve, reject) => {
          if (!bgmAudio) {
            reject(new Error("BGM ?ì„± ?¤íŒ¨"))
            return
          }
          bgmAudio.onloadeddata = () => {
            // BGM??timeupdate ?´ë²¤?¸ë¡œ ì¢…ë£Œ ?œê°„ ì²´í¬ (ì¶”ê? ë³´í˜¸)
            const currentBgmAudio = bgmAudio // ?´ë¡œ?€?ì„œ ?ˆì „?˜ê²Œ ?‘ê·¼?˜ê¸° ?„í•´ ë¡œì»¬ ë³€?˜ì— ?€??            if (currentBgmAudio) {
              currentBgmAudio.addEventListener("timeupdate", () => {
                if (previewAudio && currentBgmAudio && !currentBgmAudio.paused) {
                const elapsed = previewAudio.currentTime
                  // ì¢…ë£Œ ?œê°„???„ë‹¬?ˆê±°???˜ì–´ê°”ê±°???¤ë””?¤ê? ?ë‚¬?¼ë©´ ì¦‰ì‹œ ?•ì? (?„ê²©??ì²´í¬)
                  if (elapsed >= bgmEndTime || elapsed < bgmStartTime || elapsed >= previewAudio.duration || previewAudio.ended) {
                    console.log(`[Shopping] BGM timeupdate ?´ë²¤?¸ì—???•ì?: elapsed=${elapsed.toFixed(2)}ì´? bgmEndTime=${bgmEndTime}ì´?)
                    currentBgmAudio.pause()
                    currentBgmAudio.currentTime = 0
                  }
                }
              })
              // BGM???ë‚¬???Œë„ ì²´í¬?˜ì—¬ ?¬ìƒ ?œê°„?€ë¥??˜ì—ˆ?¼ë©´ ?¬ìƒ?˜ì? ?ŠìŒ
              currentBgmAudio.addEventListener("ended", () => {
                if (previewAudio) {
                  const elapsed = previewAudio.currentTime
                  // BGM ?ì²´ê°€ ?ë‚¬?´ë„ ë©”ì¸ ?¤ë””???œê°„??ì²´í¬?˜ì—¬ ì¢…ë£Œ ?œê°„???˜ì—ˆ?¼ë©´ ?¬ìƒ?˜ì? ?ŠìŒ
                  if (elapsed >= bgmEndTime || elapsed < bgmStartTime || elapsed >= previewAudio.duration || previewAudio.ended) {
                    console.log(`[Shopping] BGM ended ?´ë²¤?? ?¬ìƒ ?œê°„?€ ë°–ì´ë¯€ë¡??¬ìƒ?˜ì? ?ŠìŒ, elapsed=${elapsed.toFixed(2)}ì´? bgmEndTime=${bgmEndTime}ì´?)
                    currentBgmAudio.pause()
                    currentBgmAudio.currentTime = 0
                  } else if (elapsed >= bgmStartTime && elapsed < bgmEndTime && elapsed < previewAudio.duration && !previewAudio.ended) {
                    // ?¬ìƒ ?œê°„?€ ?´ì— ?ˆìœ¼ë©??¤ì‹œ ?¬ìƒ (ë£¨í”„)
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
              // previewBgmAudioê°€ ?¤ì •???„ì—??ended ?´ë²¤?¸ë? ì¶”ê??˜ì—¬ ì¢…ë£Œ ?œê°„ ì²´í¬
              // ?´ëŠ” BGM???ì²´?ìœ¼ë¡??ë‚¬???Œë„ ë©”ì¸ ?¤ë””???œê°„??ì²´í¬?˜ê¸° ?„í•¨
              const bgmEndedHandler = () => {
                if (previewAudio && currentBgmAudio) {
                  const elapsed = previewAudio.currentTime
                  // BGM ?ì²´ê°€ ?ë‚¬?´ë„ ë©”ì¸ ?¤ë””???œê°„??ì²´í¬?˜ì—¬ ì¢…ë£Œ ?œê°„???˜ì—ˆ?¼ë©´ ?¬ìƒ?˜ì? ?ŠìŒ
                  if (elapsed >= bgmEndTime || elapsed < bgmStartTime || elapsed >= previewAudio.duration || previewAudio.ended) {
                    console.log(`[Shopping] ??BGM ended ?´ë²¤??(previewBgmAudio): ?¬ìƒ ?œê°„?€ ë°–ì´ë¯€ë¡??¬ìƒ?˜ì? ?ŠìŒ, elapsed=${elapsed.toFixed(2)}ì´? bgmEndTime=${bgmEndTime}ì´?)
                    currentBgmAudio.pause()
                    currentBgmAudio.currentTime = 0
                  } else if (elapsed >= bgmStartTime && elapsed < bgmEndTime && elapsed < previewAudio.duration && !previewAudio.ended) {
                    // ?¬ìƒ ?œê°„?€ ?´ì— ?ˆìœ¼ë©??¤ì‹œ ?¬ìƒ (ë£¨í”„)
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
            console.warn("[Shopping] BGM ë¡œë“œ ?¤íŒ¨, ê³„ì† ì§„í–‰:", e)
            bgmAudio = null // BGM ë¡œë“œ ?¤íŒ¨ ??nullë¡??¤ì •
            setPreviewBgmAudio(null)
            resolve() // BGM???†ì–´??ê³„ì† ì§„í–‰
          }
        })
      } else {
        // BGM???†ìœ¼ë©?ê¸°ì¡´ BGM ?•ë¦¬
        if (previewBgmAudio) {
          previewBgmAudio.pause()
          previewBgmAudio.currentTime = 0
          previewBgmAudio.src = "" // ?¤ë””???ŒìŠ¤ ?œê±°
          previewBgmAudio.load() // ?¤ë””??ë¦¬ì†Œ???´ì œ
          setPreviewBgmAudio(null)
        }
      }

      // ?¨ê³¼??ë¡œë“œ (?ˆëŠ” ê²½ìš°)
      if (sfxUrl) {
        console.log("[Shopping] ?¨ê³¼??ë¡œë“œ")
        sfxAudio = new Audio(sfxUrl)
        sfxAudio.volume = sfxVolume
        sfxAudio.loop = false
        
        await new Promise<void>((resolve, reject) => {
          if (!sfxAudio) {
            reject(new Error("?¨ê³¼???ì„± ?¤íŒ¨"))
            return
          }
          sfxAudio.onloadeddata = () => {
            setPreviewSfxAudio(sfxAudio)
            resolve()
          }
          sfxAudio.onerror = (e) => {
            console.warn("[Shopping] ?¨ê³¼??ë¡œë“œ ?¤íŒ¨, ê³„ì† ì§„í–‰:", e)
            sfxAudio = null
            setPreviewSfxAudio(null)
            resolve()
          }
        })
      } else {
        // ?¨ê³¼?Œì´ ?†ìœ¼ë©?ê¸°ì¡´ ?¨ê³¼???•ë¦¬
        if (previewSfxAudio) {
          previewSfxAudio.pause()
          previewSfxAudio.currentTime = 0
          setPreviewSfxAudio(null)
        }
      }

      const actualAudioDuration = audio.duration
      console.log("[Shopping] ?¤ì œ ?¤ë””??ê¸¸ì´:", actualAudioDuration.toFixed(3), "ì´?)

      // ë¹„ë””???˜ë¦¬ë¨¼íŠ¸ê°€ ?†ê±°??ê°œìˆ˜ê°€ ë§ì? ?Šìœ¼ë©??ˆë¡œ ë¡œë“œ
      if (!videoElements || videoElements.length !== videoUrlsArray.length) {
        console.log("[Shopping] ë¹„ë””???ˆë¡œ ë¡œë“œ")
        videoElements = []
        for (let i = 0; i < videoUrlsArray.length; i++) {
          const videoUrl = videoUrlsArray[i]
          const video = document.createElement("video")
          video.crossOrigin = "anonymous"
          video.src = videoUrl
          video.muted = true
          video.playsInline = true
          // ëª¨ë°”?¼ì—?????˜ì? ë²„í¼ë§ì„ ?„í•´ preload ?¤ì •
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                          (typeof window !== "undefined" && window.innerWidth <= 768)
          // ëª¨ë°”?¼ì—?œë„ autoë¡??¤ì •?˜ì—¬ ì¶©ë¶„??ë²„í¼ë§?ë³´ì¥
          video.preload = "auto"
          
          await new Promise<void>((resolve, reject) => {
            // loadedmetadata?€ canplay ?´ë²¤???¬ìš©
            let metadataLoaded = false
            let canPlay = false
            let canPlayThrough = false
            
            const checkReady = () => {
              // ëª¨ë°”?¼ì—?œëŠ” canplaythroughê¹Œì? ê¸°ë‹¤ë¦?              if (isMobile) {
                if (metadataLoaded && canPlay && canPlayThrough) {
                  video.currentTime = 0 // ?œì‘ ?„ì¹˜ë¡?ì´ˆê¸°??                  console.log(`[Shopping] ë¹„ë””??${i + 1} ë¡œë“œ ?„ë£Œ (ëª¨ë°”??: duration=${video.duration.toFixed(2)}ì´? readyState=${video.readyState}`)
                  resolve()
                }
              } else {
              if (metadataLoaded && canPlay) {
                video.currentTime = 0 // ?œì‘ ?„ì¹˜ë¡?ì´ˆê¸°??                console.log(`[Shopping] ë¹„ë””??${i + 1} ë¡œë“œ ?„ë£Œ: duration=${video.duration.toFixed(2)}ì´?)
                resolve()
                }
              }
            }
            
            video.onloadedmetadata = () => {
              metadataLoaded = true
              console.log(`[Shopping] ë¹„ë””??${i + 1} ë©”í??°ì´??ë¡œë“œ ?„ë£Œ`)
              checkReady()
            }
            
            video.oncanplay = () => {
              canPlay = true
              console.log(`[Shopping] ë¹„ë””??${i + 1} canplay ?´ë²¤??)
              checkReady()
            }
            
            // ëª¨ë°”?¼ì—??ë²„í¼ë§?ê°œì„ ???„í•œ ?´ë²¤??ì¶”ê?
            if (isMobile) {
              video.oncanplaythrough = () => {
                canPlayThrough = true
                console.log(`[Shopping] ë¹„ë””??${i + 1} canplaythrough ?´ë²¤??(ëª¨ë°”??`)
                checkReady()
              }
            }
            
            video.onerror = (e) => {
              console.error(`[Shopping] ë¹„ë””??${i + 1} ë¡œë“œ ?ëŸ¬:`, e)
              reject(new Error(`ë¹„ë””??${i + 1} ë¡œë“œ ?¤íŒ¨`))
            }
            
            video.load()
            
            // ?€?„ì•„???¤ì • (ëª¨ë°”?¼ì—?œëŠ” ??ê¸¸ê²Œ)
            const timeout = isMobile ? 30000 : 15000
            setTimeout(() => {
              if (isMobile && (!metadataLoaded || !canPlay || !canPlayThrough)) {
                console.warn(`[Shopping] ë¹„ë””??${i + 1} ë¡œë“œ ?€?„ì•„??(ëª¨ë°”??, ê³„ì† ì§„í–‰ (readyState: ${video.readyState})`)
                if (video.readyState >= 2) {
                  // canplay ?´ìƒ?´ë©´ ê³„ì† ì§„í–‰
                  metadataLoaded = true
                  canPlay = true
                  canPlayThrough = true
                  checkReady()
                } else {
                  resolve() // ?€?„ì•„?ƒì´?´ë„ ê³„ì† ì§„í–‰
                }
              } else if (!isMobile && (!metadataLoaded || !canPlay)) {
                console.warn(`[Shopping] ë¹„ë””??${i + 1} ë¡œë“œ ?€?„ì•„?? ê³„ì† ì§„í–‰ (readyState: ${video.readyState})`)
                if (video.readyState >= 1) {
                  // ë©”í??°ì´?°ë¼???ˆìœ¼ë©?ê³„ì† ì§„í–‰
                  metadataLoaded = true
                  canPlay = true
                  checkReady()
                } else {
                  resolve() // ?€?„ì•„?ƒì´?´ë„ ê³„ì† ì§„í–‰
                }
              }
            }, timeout)
          })
          videoElements.push(video)
        }
        setPreviewVideoElements(videoElements)
      } else {
        console.log("[Shopping] ê¸°ì¡´ ë¹„ë””???¬ì‚¬??)
        // ê¸°ì¡´ ë¹„ë””???¬ì‚¬?????œê°„ ì´ˆê¸°??        for (const video of videoElements) {
          video.currentTime = 0
          video.pause()
        }
      }

      // ê°??ìƒ???¤ì œ duration ê°€?¸ì˜¤ê¸?      const videoDurations: number[] = []
      for (const video of videoElements) {
        if (video.duration && !isNaN(video.duration) && video.duration > 0) {
          videoDurations.push(video.duration)
        } else {
          // duration???†ìœ¼ë©?ê¸°ë³¸ê°??¬ìš© (?˜ì¤‘???…ë°?´íŠ¸)
          videoDurations.push(5) // ê¸°ë³¸ 5ì´?        }
      }

      console.log("[Shopping] ê°??ìƒ???¤ì œ ê¸¸ì´:", videoDurations.map(d => d.toFixed(2) + "ì´?))

      // ê°??ìƒ???œì‘ ?œê°„ ê³„ì‚° (ê°„ë‹¨?˜ê²Œ ?œì°¨?ìœ¼ë¡??´ì–´ë¶™ì´ê¸?
      let accumulatedTime = 0
      const videoStartTimes: number[] = []
      for (let i = 0; i < videoDurations.length; i++) {
        videoStartTimes.push(accumulatedTime)
        accumulatedTime += videoDurations[i]
      }

      console.log("[Shopping] ê°??ìƒ???œì‘ ?œê°„:", videoStartTimes.map(t => t.toFixed(2) + "ì´?))

      // ?¸ë„¤???´ë?ì§€ ë¡œë“œ (? íƒ???¸ë„¤???¬ìš©)
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
            // ?€?„ì•„???¤ì •
            setTimeout(() => {
              if (!thumbnailImage!.complete) {
                reject(new Error("?¸ë„¤??ë¡œë“œ ?€?„ì•„??))
              }
            }, 5000)
          })
          console.log("[Shopping] ? íƒ???¸ë„¤???´ë?ì§€ ë¡œë“œ ?„ë£Œ (?¸ë±??", selectedThumbnailIndex, ")")
        } catch (error) {
          console.warn("[Shopping] ?¸ë„¤???´ë?ì§€ ë¡œë“œ ?¤íŒ¨, ê³„ì† ì§„í–‰:", error)
        }
      } else if (thumbnailUrl) {
        // ? íƒ???¸ë„¤?¼ì´ ?†ìœ¼ë©?ê¸°ì¡´ thumbnailUrl ?¬ìš© (?˜ìœ„ ?¸í™˜??
        try {
          thumbnailImage = new Image()
          thumbnailImage.crossOrigin = "anonymous"
          thumbnailImage.src = thumbnailUrl
          await new Promise<void>((resolve, reject) => {
            thumbnailImage!.onload = () => resolve()
            thumbnailImage!.onerror = reject
            setTimeout(() => {
              if (!thumbnailImage!.complete) {
                reject(new Error("?¸ë„¤??ë¡œë“œ ?€?„ì•„??))
              }
            }, 5000)
          })
          console.log("[Shopping] ?¸ë„¤???´ë?ì§€ ë¡œë“œ ?„ë£Œ (ê¸°ì¡´ URL)")
        } catch (error) {
          console.warn("[Shopping] ?¸ë„¤???´ë?ì§€ ë¡œë“œ ?¤íŒ¨, ê³„ì† ì§„í–‰:", error)
        }
      }

      // ë¯¸ë¦¬ë³´ê¸° ?Œë”ë§??¨ìˆ˜ (?¸ë„¤???¬í•¨, BGM ë°??¨ê³¼???ìš©)
      let lastVideoIndex = -1
      const currentBgmAudio = bgmAudio // ?´ë¡œ?€?ì„œ ?‘ê·¼ ê°€?¥í•˜?„ë¡
      const currentSfxAudio = sfxAudio // ?´ë¡œ?€?ì„œ ?‘ê·¼ ê°€?¥í•˜?„ë¡
      const THUMBNAIL_DURATION = 0.0001
      
      const renderPreview = () => {
        const elapsed = audio.paused ? currentTime : audio.currentTime
        if (!audio.paused) {
          setCurrentTime(elapsed)
          
          // BGM ?œê°„?€ ì²´í¬ ë°??¬ìƒ/?•ì?
          if (currentBgmAudio && bgmUrl) {
            // bgmEndTime???„ë‹¬?ˆê±°???˜ì–´ê°”ê±°??bgmStartTime ?´ì „?´ë©´ ë¬´ì¡°ê±??•ì? (?„ê²©??ì²´í¬)
            // bgmEndTime???„ë‹¬?˜ë©´ ì¦‰ì‹œ ?•ì? (?? 10ì´ˆì— ?„ë‹¬?˜ë©´ ?•ì?)
            if (previewAudio && (elapsed >= bgmEndTime || elapsed < bgmStartTime || elapsed >= previewAudio.duration || previewAudio.ended)) {
              if (!currentBgmAudio.paused) {
                currentBgmAudio.pause()
                currentBgmAudio.currentTime = 0
              }
            } else if (previewAudio && elapsed >= bgmStartTime && elapsed < bgmEndTime && elapsed < previewAudio.duration && !previewAudio.ended) {
              // BGM ?¬ìƒ ?œê°„?€ ?´ì— ?ˆì„ ?Œë§Œ ?¬ìƒ (elapsed < bgmEndTime - ì¢…ë£Œ ?œê°„???„ë‹¬?˜ë©´ ?¬ìƒ?˜ì? ?ŠìŒ)
              if (currentBgmAudio.paused) {
                // BGM ?œì‘ ?œê°„??ë§ì¶° ?¤ë””???„ì¹˜ ?¤ì •
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
                // BGM???¬ìƒ ì¤‘ì´ë©?ì¢…ë£Œ ?œê°„???„ë‹¬?ˆëŠ”ì§€ ê³„ì† ?•ì¸
                if (elapsed >= bgmEndTime || elapsed >= previewAudio.duration || previewAudio.ended) {
                  // ì¢…ë£Œ ?œê°„???„ë‹¬?ˆê±°???˜ì–´ê°”ê±°???¤ë””?¤ê? ?ë‚¬?¼ë©´ ì¦‰ì‹œ ?•ì?
                  currentBgmAudio.pause()
                  currentBgmAudio.currentTime = 0
                }
              }
            } else {
              // BGM ?¬ìƒ ?œê°„?€ ë°–ì´ë©?ë¬´ì¡°ê±??•ì?
              if (!currentBgmAudio.paused) {
                currentBgmAudio.pause()
                currentBgmAudio.currentTime = 0
              }
            }
          }
          
          // ?¨ê³¼???œê°„?€ ì²´í¬ ë°??¬ìƒ/?•ì?
          if (currentSfxAudio && sfxUrl) {
            if (elapsed >= sfxStartTime && elapsed < sfxEndTime) {
              if (currentSfxAudio.paused) {
                // ?¨ê³¼???œì‘ ?œê°„??ë§ì¶° ?¤ë””???„ì¹˜ ?¤ì •
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

        // ìº”ë²„??ì´ˆê¸°??        ctx.fillStyle = "black"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // ?¸ë„¤?¼ì´ ?ˆê³  0.0001ì´??´í•˜?????¸ë„¤???œì‹œ
        const adjustedElapsed = Math.max(0, elapsed - THUMBNAIL_DURATION)
        
        if (thumbnailImage && elapsed < THUMBNAIL_DURATION) {
          ctx.drawImage(thumbnailImage, 0, 0, canvas.width, canvas.height)
        } else {
          // ?¸ë„¤???œê°„??ì§€?˜ë©´ ê¸°ì¡´ ?ìƒ ?œì‹œ
          // ?„ì¬ ?œê°„??ë§ëŠ” ?ìƒ ì°¾ê¸° (?¸ë„¤???œê°„ ?œì™¸)
        let currentVideoIndex = -1
        for (let i = 0; i < videoStartTimes.length; i++) {
          const startTime = videoStartTimes[i]
          const endTime = i < videoStartTimes.length - 1 ? videoStartTimes[i + 1] : startTime + videoDurations[i]
          
            if (adjustedElapsed >= startTime && adjustedElapsed < endTime) {
            currentVideoIndex = i
            break
          }
        }

        // ë¹„ë””???„í™˜ ?œì—ë§?ì²˜ë¦¬
        if (currentVideoIndex !== lastVideoIndex) {
          // ?´ì „ ë¹„ë””???¼ì‹œ?•ì?
          if (lastVideoIndex >= 0 && videoElements[lastVideoIndex]) {
            videoElements[lastVideoIndex].pause()
            videoElements[lastVideoIndex].currentTime = 0
          }
          
          // ??ë¹„ë””???¬ìƒ ?œì‘
          if (currentVideoIndex >= 0 && videoElements[currentVideoIndex]) {
            const video = videoElements[currentVideoIndex]
            const videoStartTime = videoStartTimes[currentVideoIndex]
              const videoElapsed = adjustedElapsed - videoStartTime
            
            if (video && !isNaN(video.duration) && video.duration > 0) {
              // ëª¨ë°”?¼ì—??ë¹„ë””?¤ê? ?„ì „??ë¡œë“œ?˜ì—ˆ?”ì? ?•ì¸
              const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                              (typeof window !== "undefined" && window.innerWidth <= 768)
              
              // ëª¨ë°”?¼ì—?œëŠ” readyStateê°€ ì¶©ë¶„???’ì•„???¬ìƒ ê°€??              if (isMobile && video.readyState < 2) {
                // ë¹„ë””?¤ê? ?„ì§ ë¡œë“œ?˜ì? ?Šì•˜?¼ë©´ ë¡œë“œ ?€ê¸?                video.load()
                video.addEventListener("canplay", () => {
                  video.currentTime = Math.max(0, Math.min(videoElapsed, video.duration))
                  video.play().catch((error) => {
                    console.warn(`[Shopping] ëª¨ë°”??ë¹„ë””???¬ìƒ ?¤íŒ¨, ?¬ì‹œ??`, error)
                    // ?¬ì‹œ??                    setTimeout(() => {
                      video.play().catch(() => {})
                    }, 100)
                  })
                }, { once: true })
              } else {
              // ?œì‘ ?œê°„ ?¤ì •
              video.currentTime = Math.max(0, Math.min(videoElapsed, video.duration))
              // ë¹„ë””???¬ìƒ (?ì²´?ìœ¼ë¡??¬ìƒ?˜ë„ë¡?
                video.play().catch((error) => {
                  console.warn(`[Shopping] ë¹„ë””???¬ìƒ ?¤íŒ¨:`, error)
                  // ëª¨ë°”?¼ì—???¬ìƒ ?¤íŒ¨ ???¬ì‹œ??                  if (isMobile) {
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

          // ?„ì¬ ?ìƒ??ìº”ë²„?¤ì— ê·¸ë¦¬ê¸?(ë¹„ìœ¨ ? ì?)
          if (currentVideoIndex >= 0 && videoElements[currentVideoIndex]) {
            const currentVideo = videoElements[currentVideoIndex]
            
            try {
              if (currentVideo.readyState >= 2 || (currentVideo.videoWidth > 0 && currentVideo.videoHeight > 0)) {
                const videoWidth = currentVideo.videoWidth
                const videoHeight = currentVideo.videoHeight
                const canvasWidth = canvas.width
                const canvasHeight = canvas.height
                
                // ë¹„ë””?¤ì? ìº”ë²„?¤ì˜ ë¹„ìœ¨ ê³„ì‚°
                const videoAspect = videoWidth / videoHeight
                const canvasAspect = canvasWidth / canvasHeight
                
                let drawWidth = canvasWidth
                let drawHeight = canvasHeight
                let drawX = 0
                let drawY = 0
                
                // ë¹„ìœ¨??ë§ì¶° ì¤‘ì•™ ?¬ë¡­ (cover ë°©ì‹)
                if (videoAspect > canvasAspect) {
                  // ë¹„ë””?¤ê? ???“ìŒ - ?’ì´??ë§ì¶”ê³?ì¢Œìš° ?¬ë¡­
                  drawHeight = canvasHeight
                  drawWidth = drawHeight * videoAspect
                  drawX = (canvasWidth - drawWidth) / 2
                } else {
                  // ë¹„ë””?¤ê? ???’ìŒ - ?ˆë¹„??ë§ì¶”ê³??í•˜ ?¬ë¡­
                  drawWidth = canvasWidth
                  drawHeight = drawWidth / videoAspect
                  drawY = (canvasHeight - drawHeight) / 2
                }
                
                ctx.drawImage(currentVideo, 0, 0, videoWidth, videoHeight, drawX, drawY, drawWidth, drawHeight)
              }
            } catch (e) {
              // ê·¸ë¦¬ê¸??¤íŒ¨ ??ë¬´ì‹œ
            }
          }
        }

        // ?ë§‰ ê·¸ë¦¬ê¸?(?¸ë„¤???œê°„ ?™ì•ˆ?ëŠ” ?œì‹œ?˜ì? ?ŠìŒ)
        if (scriptLines.length > 0 && (!thumbnailImage || elapsed >= THUMBNAIL_DURATION)) {
          const elapsedMs = adjustedElapsed * 1000
          const currentLine = scriptLines.find(
            line => elapsedMs >= line.startTime && elapsedMs < line.endTime
          )
          
          if (currentLine) {
            // ?˜ë? ?¨ìœ„(?¼í‘œÂ·ë§ˆì¹¨??ê¸°ì?)ë¡??˜ëˆ  ??ì¤„ì”© ?œì„œ?€ë¡??œì‹œ
            const phrases = getSubtitlePhrases(currentLine.text)
            const lineDuration = currentLine.endTime - currentLine.startTime
            const timeInLine = elapsedMs - currentLine.startTime
            const phraseIndex = phrases.length <= 1 ? 0 : Math.min(Math.floor((timeInLine / lineDuration) * phrases.length), phrases.length - 1)
            const textToShow = phrases[phraseIndex] || currentLine.text
            const subtitleY = canvas.height * 0.38
            
            // ?ë§‰ ?ìŠ¤??(ë°°ê²½ ?†ìŒ, ê²€???Œë‘ë¦?
            ctx.font = "bold 100px 'Noto Sans KR', sans-serif"
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            
            // ê²€?•ìƒ‰ ?Œë‘ë¦?            ctx.strokeStyle = "black"
            ctx.lineWidth = 12
            ctx.lineJoin = "round"
            ctx.strokeText(textToShow, canvas.width / 2, subtitleY)
            
            // ?°ìƒ‰ ê¸€??            ctx.fillStyle = "white"
            ctx.fillText(textToShow, canvas.width / 2, subtitleY)
          }
        }

        if (!audio.ended && !audio.paused) {
          const frameId = requestAnimationFrame(renderPreview)
          setPreviewAnimationFrame(frameId)
        } else {
          setIsPlaying(false)
          // ëª¨ë“  ë¹„ë””???¼ì‹œ?•ì?
          for (const video of videoElements) {
            video.pause()
          }
          // BGM ?¼ì‹œ?•ì? ë°??•ì?
          if (currentBgmAudio) {
            currentBgmAudio.pause()
            currentBgmAudio.currentTime = 0 // BGM ?œê°„ ì´ˆê¸°??          }
          // ?¨ê³¼???¼ì‹œ?•ì? ë°??•ì?
          if (currentSfxAudio) {
            currentSfxAudio.pause()
            currentSfxAudio.currentTime = 0
          }
        }
      }

      // ë¯¸ë¦¬ë³´ê¸° ?¨ê³„ë¡??´ë™
      setActiveStep("preview")
      
      // ì´ˆê¸° ?„ë ˆ??ê·¸ë¦¬ê¸?(?¬ìƒ?˜ì? ?Šê³  ì²??„ë ˆ?„ë§Œ ?œì‹œ)
      audio.currentTime = 0
      setCurrentTime(0)
      
      // ì´ˆê¸° ?„ë ˆ???Œë”ë§?(?œê°„ 0?¼ë¡œ ?¤ì •)
      const initialElapsed = 0
      const THUMBNAIL_DURATION_INIT = 0.0001
      
      // ìº”ë²„??ì´ˆê¸°??      ctx.fillStyle = "black"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // ?¸ë„¤?¼ì´ ?ˆìœ¼ë©?ë¨¼ì? ?œì‹œ, ?†ìœ¼ë©?ì²?ë²ˆì§¸ ?ìƒ ?œì‹œ
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
            
            // ë¹„ë””?¤ì? ìº”ë²„?¤ì˜ ë¹„ìœ¨ ê³„ì‚°
            const videoAspect = videoWidth / videoHeight
            const canvasAspect = canvasWidth / canvasHeight
            
            let drawWidth = canvasWidth
            let drawHeight = canvasHeight
            let drawX = 0
            let drawY = 0
            
            // ë¹„ìœ¨??ë§ì¶° ì¤‘ì•™ ?¬ë¡­ (cover ë°©ì‹)
            if (videoAspect > canvasAspect) {
              // ë¹„ë””?¤ê? ???“ìŒ - ?’ì´??ë§ì¶”ê³?ì¢Œìš° ?¬ë¡­
              drawHeight = canvasHeight
              drawWidth = drawHeight * videoAspect
              drawX = (canvasWidth - drawWidth) / 2
            } else {
              // ë¹„ë””?¤ê? ???’ìŒ - ?ˆë¹„??ë§ì¶”ê³??í•˜ ?¬ë¡­
              drawWidth = canvasWidth
              drawHeight = drawWidth / videoAspect
              drawY = (canvasHeight - drawHeight) / 2
            }
            
            ctx.drawImage(video, 0, 0, videoWidth, videoHeight, drawX, drawY, drawWidth, drawHeight)
          }
        } catch (e) {
          console.warn("ì´ˆê¸° ë¹„ë””??ê·¸ë¦¬ê¸??¤íŒ¨:", e)
        }
      }
      
      // ?ë™ ?¬ìƒ?˜ì? ?ŠìŒ (?¬ìƒ ë²„íŠ¼???ŒëŸ¬???¬ìƒ??
    } catch (error) {
      console.error("ë¯¸ë¦¬ë³´ê¸° ?¤íŒ¨:", error)
      setError(`ë¯¸ë¦¬ë³´ê¸°???¤íŒ¨?ˆìŠµ?ˆë‹¤: ${error instanceof Error ? error.message : "?????†ëŠ” ?¤ë¥˜"}`)
    }
  }

  // ë¯¸ë¦¬ë³´ê¸° ?ì„± (ë¡±í¼ ë°©ì‹: HTML video ?˜ë¦¬ë¨¼íŠ¸ ?¬ìš©)
  // [ëª¨ë°”?¼ì—???Šê¸°???´ìœ ]
  // 1) ë©”ëª¨ë¦? ?ìƒ 3ê°??¤ë””???¸ë„¤?¼ì„ ?œêº¼ë²ˆì— ë¡œë“œ?˜ë©´ ë©”ëª¨ë¦?ë¶€ì¡±ìœ¼ë¡???´ ì£½ê±°???Šê¸¸ ???ˆìŒ.
  // 2) iOS: canplaythroughê°€ ?¬ìƒ ?„ì—???????¨ë?ë¡? ëª¨ë°”?¼ì—?œëŠ” canplayë§??¬ìš©?˜ê³  ?€?„ì•„?ƒì„ ?‰ë„‰????
  // 3) ?¤ìš´ë¡œë“œ(MediaRecorder): Safari/iOS??video/webm;vp9ë¥?ì§€?í•˜ì§€ ?Šì•„ ?¹í™”ê°€ ?¤íŒ¨?????ˆìŒ ??ì§€??ì½”ë±?¼ë¡œ ?´ë°± ì²˜ë¦¬.
  const handleGeneratePreview = async () => {
    // 3ê°œì˜ ê°œë³„ ?ìƒ??ëª¨ë‘ ì¤€ë¹„ë˜?´ì•¼ ??    if (convertedVideoUrls.size !== 3 || !ttsAudioUrl) {
      alert("3ê°œì˜ ?ìƒê³?TTSê°€ ëª¨ë‘ ì¤€ë¹„ë˜?´ì•¼ ?©ë‹ˆ??")
      return
    }

    setIsGeneratingPreview(true)
    setError("")
    
    try {
      console.log("[Shopping] ë¯¸ë¦¬ë³´ê¸° ?ì„± ?œì‘ (ë¡±í¼ ë°©ì‹)")

      // ?¤ë””??ë¡œë“œ (blob URL?¸ì? ?•ì¸)
      let audioUrl: string
      if (ttsAudioUrl.startsWith("blob:")) {
        // blob URL?´ë©´ ì§ì ‘ ?¬ìš©
        audioUrl = ttsAudioUrl
      } else {
        // ?¼ë°˜ URL?´ë©´ fetchë¡?ê°€?¸ì˜¤ê¸?        const audioResponse = await fetch(ttsAudioUrl)
        const audioBlob = await audioResponse.blob()
        audioUrl = URL.createObjectURL(audioBlob)
      }
      
      const audio = new Audio(audioUrl)
      audio.volume = ttsVolume // TTS ë³¼ë¥¨ ?¤ì •

      await new Promise<void>((resolve, reject) => {
        audio.onloadeddata = () => resolve()
        audio.onerror = reject
      })

      const actualAudioDuration = audio.duration
      console.log("[Shopping] ?¤ì œ ?¤ë””??ê¸¸ì´:", actualAudioDuration.toFixed(3), "ì´?)

      // BGM ë¡œë“œ (?ˆëŠ” ê²½ìš°)
      let bgmAudio: HTMLAudioElement | null = null
      let sfxAudio: HTMLAudioElement | null = null
      if (bgmUrl) {
        // ?ˆë¡œ??BGM??ë§Œë“¤ê¸??„ì— ?´ì „ BGM ?•ë¦¬
        if (previewBgmAudio) {
          console.log("[Shopping] ?´ì „ BGM ?•ë¦¬")
          previewBgmAudio.pause()
          previewBgmAudio.currentTime = 0
          previewBgmAudio.src = "" // ?¤ë””???ŒìŠ¤ ?œê±°
          previewBgmAudio.load() // ?¤ë””??ë¦¬ì†Œ???´ì œ
          setPreviewBgmAudio(null)
        }
        
        console.log("[Shopping] BGM ë¡œë“œ")
        bgmAudio = new Audio(bgmUrl)
        bgmAudio.volume = bgmVolume
        bgmAudio.loop = false // ?œê°„?€??ë§ê²Œ ?¬ìƒ?˜ë?ë¡?loop ?´ì œ
        
        await new Promise<void>((resolve, reject) => {
          if (!bgmAudio) {
            reject(new Error("BGM ?ì„± ?¤íŒ¨"))
            return
          }
          bgmAudio.onloadeddata = () => {
            setPreviewBgmAudio(bgmAudio)
            resolve()
          }
          bgmAudio.onerror = (e) => {
            console.warn("[Shopping] BGM ë¡œë“œ ?¤íŒ¨, ê³„ì† ì§„í–‰:", e)
            bgmAudio = null
            setPreviewBgmAudio(null)
            resolve() // BGM???†ì–´??ê³„ì† ì§„í–‰
          }
        })
      } else {
        // BGM???†ìœ¼ë©?ê¸°ì¡´ BGM ?•ë¦¬
        if (previewBgmAudio) {
          previewBgmAudio.pause()
          previewBgmAudio.currentTime = 0
          previewBgmAudio.src = "" // ?¤ë””???ŒìŠ¤ ?œê±°
          previewBgmAudio.load() // ?¤ë””??ë¦¬ì†Œ???´ì œ
          setPreviewBgmAudio(null)
        }
      }

      // ?¨ê³¼??ë¡œë“œ (?ˆëŠ” ê²½ìš°)
      if (sfxUrl) {
        console.log("[Shopping] ?¨ê³¼??ë¡œë“œ")
        sfxAudio = new Audio(sfxUrl)
        sfxAudio.volume = sfxVolume
        sfxAudio.loop = false
        
        await new Promise<void>((resolve, reject) => {
          if (!sfxAudio) {
            reject(new Error("?¨ê³¼???ì„± ?¤íŒ¨"))
            return
          }
          sfxAudio.onloadeddata = () => {
            setPreviewSfxAudio(sfxAudio)
            resolve()
          }
          sfxAudio.onerror = (e) => {
            console.warn("[Shopping] ?¨ê³¼??ë¡œë“œ ?¤íŒ¨, ê³„ì† ì§„í–‰:", e)
            sfxAudio = null
            setPreviewSfxAudio(null)
            resolve()
          }
        })
      } else {
        // ?¨ê³¼?Œì´ ?†ìœ¼ë©?ê¸°ì¡´ ?¨ê³¼???•ë¦¬
        if (previewSfxAudio) {
          previewSfxAudio.pause()
          previewSfxAudio.currentTime = 0
          setPreviewSfxAudio(null)
        }
      }

      // 3ê°œì˜ ê°œë³„ ?ìƒ ë¡œë“œ (ë¡±í¼ ë°©ì‹: HTML video ?˜ë¦¬ë¨¼íŠ¸ë¡?ì§ì ‘ ?¬ìš©)
      const videoElements: HTMLVideoElement[] = []
      const videoDurations: number[] = []
      
      // TTS ê¸¸ì´ë¥?3?¼ë¡œ ?˜ëˆˆ ê°?ê³„ì‚°
      const durationPerVideo = Math.round(actualAudioDuration / 3)
      
      for (let i = 0; i < 3; i++) {
        const videoUrl = convertedVideoUrls.get(i)
        if (!videoUrl) {
          throw new Error(`?ìƒ ${i + 1}??ì¤€ë¹„ë˜ì§€ ?Šì•˜?µë‹ˆ??`)
        }
        
        const video = document.createElement("video")
        // blob: URL?€ same-origin?´ë¼ crossOrigin ë¶ˆí•„?? ?¸ë? URLë§?anonymous (CORS)
        if (!videoUrl.startsWith("blob:")) {
        video.crossOrigin = "anonymous"
        }
        video.src = videoUrl
        video.muted = true
        video.playsInline = true
        // ëª¨ë°”?¼ì—?????˜ì? ë²„í¼ë§ì„ ?„í•´ preload ?¤ì •
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                        (typeof window !== "undefined" && window.innerWidth <= 768)
        // ëª¨ë°”?? canplayë§?ê¸°ë‹¤ë¦?(iOS??canplaythroughê°€ ?¬ìƒ ?„ì— ???¨ì–´???Šê?Â·?€?„ì•„???ì¸)
        video.preload = "auto"
        video.loop = false // ?œì°¨ ?¬ìƒ?´ë?ë¡?ë£¨í”„ ?†ìŒ
        
        await new Promise<void>((resolve, reject) => {
          let metadataLoaded = false
          let canPlay = false
          let resolved = false
          const done = () => { if (!resolved) { resolved = true; resolve() } }
          const fail = (err: Error) => { if (!resolved) { resolved = true; reject(err) } }
          
          const checkReady = () => {
            // ëª¨ë°”?? canplayë§?ë§Œì¡±?˜ë©´ ì§„í–‰ (canplaythrough ?€ê¸???iOS?ì„œ ?€?„ì•„?ƒë§Œ ?˜ê³  ?Šê?)
            if (isMobile) {
              if (metadataLoaded && canPlay) {
                const duration = video.duration || durationPerVideo
                videoDurations.push(duration)
                console.log(`[Shopping] ë¯¸ë¦¬ë³´ê¸° ?ìƒ ${i + 1} ë¡œë“œ ?„ë£Œ (ëª¨ë°”??, ê¸¸ì´: ${duration.toFixed(2)}ì´? readyState=${video.readyState}`)
                done()
              }
            } else {
              if (metadataLoaded && canPlay) {
            const duration = video.duration || durationPerVideo
            videoDurations.push(duration)
            console.log(`[Shopping] ë¯¸ë¦¬ë³´ê¸° ?ìƒ ${i + 1} ë¡œë“œ ?„ë£Œ, ê¸¸ì´: ${duration.toFixed(2)}ì´?)
                done()
              }
            }
          }
          
          video.onloadedmetadata = () => {
            metadataLoaded = true
            console.log(`[Shopping] ë¯¸ë¦¬ë³´ê¸° ?ìƒ ${i + 1} ë©”í??°ì´??ë¡œë“œ ?„ë£Œ`)
            checkReady()
          }
          
          video.oncanplay = () => {
            canPlay = true
            console.log(`[Shopping] ë¯¸ë¦¬ë³´ê¸° ?ìƒ ${i + 1} canplay ?´ë²¤??)
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
            const msg = video.error?.message ?? "?????†ìŒ"
            console.error(`[Shopping] ë¯¸ë¦¬ë³´ê¸° ?ìƒ ${i + 1} ë¡œë“œ ?¤íŒ¨: code=${code}, message=${msg}`)
            fail(new Error(`?ìƒ ${i + 1} ë¡œë“œ ?¤íŒ¨ (code: ${code}). ë¸Œë¼?°ì?ê°€ ?´ë‹¹ ?•ì‹??ì§€?í•˜ì§€ ?Šê±°???Œì¼???ìƒ?˜ì—ˆ?????ˆìŠµ?ˆë‹¤.`))
          }
          video.load()
          
          const timeout = isMobile ? 45000 : 10000
          setTimeout(() => {
            if (resolved) return
            if (metadataLoaded && canPlay) return
            if (isMobile) {
              console.warn(`ë¯¸ë¦¬ë³´ê¸° ë¹„ë””??${i + 1} ë¡œë“œ ?€?„ì•„??(ëª¨ë°”??, ê³„ì† ì§„í–‰ (readyState: ${video.readyState})`)
              if (video.readyState >= 2) {
                canPlay = true
                checkReady()
              } else {
              videoDurations.push(durationPerVideo)
                done()
              }
            } else {
              console.warn(`ë¯¸ë¦¬ë³´ê¸° ë¹„ë””??${i + 1} ë¡œë“œ ?€?„ì•„?? ê³„ì† ì§„í–‰`)
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
      
      console.log("[Shopping] ë¯¸ë¦¬ë³´ê¸° 3ê°??ìƒ ë¡œë“œ ?„ë£Œ, ê°??ìƒ ê¸¸ì´:", videoDurations.map(d => d.toFixed(2) + "ì´?))
      
      // ?¸ë„¤???´ë?ì§€ ë¡œë“œ (? íƒ???¸ë„¤???¬ìš©) - ë¯¸ë¦¬ ë¡œë“œ?˜ì—¬ ?íƒœë¡??€??      let thumbnailImage: HTMLImageElement | null = null
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
          console.log("[Shopping] ? íƒ???¸ë„¤???´ë?ì§€ ë¡œë“œ ?„ë£Œ (?¸ë±??", selectedThumbnailIndex, ")")
          setPreviewThumbnailImage(thumbnailImage)
        } catch (error) {
          console.warn("[Shopping] ?¸ë„¤???´ë?ì§€ ë¡œë“œ ?¤íŒ¨, ê³„ì† ì§„í–‰:", error)
          setPreviewThumbnailImage(null)
        }
      } else if (thumbnailUrl) {
        // ? íƒ???¸ë„¤?¼ì´ ?†ìœ¼ë©?ê¸°ì¡´ thumbnailUrl ?¬ìš© (?˜ìœ„ ?¸í™˜??
        try {
          thumbnailImage = new Image()
          thumbnailImage.crossOrigin = "anonymous"
          await new Promise<void>((resolve, reject) => {
            thumbnailImage!.onload = () => resolve()
            thumbnailImage!.onerror = reject
            thumbnailImage!.src = thumbnailUrl
          })
          console.log("[Shopping] ?¸ë„¤???´ë?ì§€ ë¡œë“œ ?„ë£Œ (ê¸°ì¡´ URL)")
          setPreviewThumbnailImage(thumbnailImage)
        } catch (error) {
          console.warn("[Shopping] ?¸ë„¤???´ë?ì§€ ë¡œë“œ ?¤íŒ¨, ê³„ì† ì§„í–‰:", error)
          setPreviewThumbnailImage(null)
        }
      } else {
        setPreviewThumbnailImage(null)
      }

      // ?¤ë””??ì¢…ë£Œ ??BGM??ë©ˆì¶”ê¸?      audio.addEventListener("ended", () => {
        console.log("[Shopping] ?¤ë””???¬ìƒ ?„ë£Œ, BGM??ë©ˆì¶¤")
        setIsPlaying(false)
        // ë¹„ë””???¼ì‹œ?•ì?
        if (previewVideoRef.current) {
          previewVideoRef.current.pause()
        }
        // BGM ê°•ì œ ?•ì? (previewBgmAudioë§??¬ìš©)
        if (previewBgmAudio) {
          previewBgmAudio.pause()
          previewBgmAudio.currentTime = 0
          // ?¤ë””???ŒìŠ¤ ?œê±°?˜ì—¬ ?„ì „???•ì?
          try {
            previewBgmAudio.src = ""
            previewBgmAudio.load()
          } catch (e) {
            console.warn("[Shopping] BGM ?•ë¦¬ ì¤??¤ë¥˜:", e)
          }
        }
        // ?¨ê³¼??ê°•ì œ ?•ì?
        if (previewSfxAudio) {
          previewSfxAudio.pause()
          previewSfxAudio.currentTime = 0
          try {
            previewSfxAudio.src = ""
            previewSfxAudio.load()
          } catch (e) {
            console.warn("[Shopping] ?¨ê³¼???•ë¦¬ ì¤??¤ë¥˜:", e)
          }
        }
      })

      // ë¡±í¼ ë°©ì‹: onTimeUpdate ?´ë²¤?¸ë¡œ ?ë§‰ ?™ê¸°??      audio.addEventListener("timeupdate", () => {
        const elapsed = audio.currentTime
        setCurrentTime(elapsed)

        // ?¤ë””?¤ê? ?ë‚¬?¼ë©´ BGMê³??¨ê³¼??ëª¨ë‘ ?•ì?
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

        // BGM ?œê°„?€ ì²´í¬ ë°??¬ìƒ/?•ì? (previewBgmAudioë§??¬ìš©)
        if (previewBgmAudio && bgmUrl) {
          // duration??? íš¨?œì? ?•ì¸ (NaN, Infinity ì²´í¬)
          const bgmDuration = previewBgmAudio.duration
          if (isFinite(bgmDuration) && bgmDuration > 0) {
            // ë¨¼ì? ì¢…ë£Œ ?œê°„???„ë‹¬?ˆê±°???˜ì–´ê°”ëŠ”ì§€ ì²´í¬ (ê°€???°ì„ ?œìœ„) - ?„ê²©??ì²´í¬
            // bgmEndTime???„ë‹¬?˜ë©´ ì¦‰ì‹œ ?•ì? (?? 10ì´ˆì— ?„ë‹¬?˜ë©´ ?•ì?)
            // ??ì²´í¬ë¥?ë¨¼ì? ?˜í–‰?˜ì—¬ BGM???¬ìƒ ì¤‘ì´???„ë‹ˆ??ë¬´ì¡°ê±??•ì?
            // CRITICAL: ??ì²´í¬??ë§?timeupdateë§ˆë‹¤ ë°˜ë“œ???¤í–‰?˜ì–´????            if (elapsed >= bgmEndTime || elapsed < bgmStartTime || elapsed >= audio.duration || audio.ended) {
              // BGM???¬ìƒ ì¤‘ì´ë©?ì¦‰ì‹œ ?•ì? (ê°•ì œ ?•ì?) - ë¬´ì¡°ê±??•ì?
              if (!previewBgmAudio.paused) {
                console.log(`[Shopping] ??BGM ê°•ì œ ?•ì?: elapsed=${elapsed.toFixed(2)}ì´? bgmEndTime=${bgmEndTime}ì´? bgmStartTime=${bgmStartTime}ì´?)
                previewBgmAudio.pause()
                previewBgmAudio.currentTime = 0
              }
              // ?¬ìƒ ?œê°„?€ ë°–ì´ë¯€ë¡????´ìƒ ì§„í–‰?˜ì? ?ŠìŒ (return?¼ë¡œ ë¹ ì ¸?˜ê°)
              return // ???œì ?ì„œ ???´ìƒ BGM ë¡œì§???¤í–‰?˜ì? ?ŠìŒ
            }
            
            // BGM ?¬ìƒ ?œê°„?€ ?´ì— ?ˆì„ ?Œë§Œ ?¬ìƒ
            if (elapsed >= bgmStartTime && elapsed < bgmEndTime && elapsed < audio.duration && !audio.ended) {
              // BGM ?¬ìƒ ?œê°„?€ ?´ì— ?ˆê³  ?¤ë””?¤ê? ?„ì§ ?ë‚˜ì§€ ?Šì•˜???Œë§Œ ?¬ìƒ
              // ì£¼ì˜: elapsed < bgmEndTime (?±í˜¸ ?†ìŒ) - ì¢…ë£Œ ?œê°„???„ë‹¬?˜ë©´ ?¬ìƒ?˜ì? ?ŠìŒ
              const bgmOffset = elapsed - bgmStartTime
              const safeCurrentTime = Math.max(0, Math.min(bgmOffset % bgmDuration, bgmDuration))
              
              if (previewBgmAudio.paused) {
                // BGM???¼ì‹œ?•ì? ?íƒœë©??¬ìƒ ?œì‘
                if (isFinite(safeCurrentTime)) {
                  previewBgmAudio.currentTime = safeCurrentTime
                  previewBgmAudio.play().catch(() => {})
                }
              } else {
                // BGM???¬ìƒ ì¤‘ì´ë©?ì¢…ë£Œ ?œê°„???˜ì–´ê°€ì§€ ?Šì•˜?”ì? ë§¤ë²ˆ ?•ì¸ (ë§¤ìš° ì¤‘ìš”!)
                // ë§?timeupdateë§ˆë‹¤ ì²´í¬?˜ì—¬ ì¢…ë£Œ ?œê°„???„ë‹¬?˜ë©´ ì¦‰ì‹œ ?•ì?
                // ê°€??ë¨¼ì? ì¢…ë£Œ ?œê°„ ì²´í¬ (?°ì„ ?œìœ„ ìµœìƒ?? - ?¬ìƒ ì¤‘ì¼ ?Œë„ ë°˜ë“œ??ì²´í¬
                if (elapsed >= bgmEndTime || elapsed >= audio.duration || audio.ended) {
                  // ì¢…ë£Œ ?œê°„???„ë‹¬?ˆê±°???˜ì–´ê°”ê±°???¤ë””?¤ê? ?ë‚¬?¼ë©´ ì¦‰ì‹œ ?•ì?
                  console.log(`[Shopping] BGM ?¬ìƒ ì¤?ì¢…ë£Œ ?œê°„ ?„ë‹¬: elapsed=${elapsed.toFixed(2)}ì´? bgmEndTime=${bgmEndTime}ì´? paused=${previewBgmAudio.paused}`)
                  previewBgmAudio.pause()
                  previewBgmAudio.currentTime = 0
                  // ?•ì? ?????´ìƒ ì§„í–‰?˜ì? ?ŠìŒ (return?¼ë¡œ ë¹ ì ¸?˜ê°)
                  return
                }
                
                // ì¢…ë£Œ ?œê°„ ?´ì— ?ˆì„ ?Œë§Œ ?œê°„ ?™ê¸°??                if (elapsed < bgmEndTime) {
                  // ì¢…ë£Œ ?œê°„ ?´ì— ?ˆìœ¼ë©??œê°„ ?™ê¸°??(0.1ì´??´ìƒ ì°¨ì´?˜ë©´)
                  if (Math.abs(previewBgmAudio.currentTime - safeCurrentTime) > 0.1) {
                    previewBgmAudio.currentTime = safeCurrentTime
                  }
                }
              }
            } else {
              // BGM ?¬ìƒ ?œê°„?€ ë°–ì´ë©?ë¬´ì¡°ê±??•ì?
              if (!previewBgmAudio.paused) {
                console.log(`[Shopping] BGM ?¬ìƒ ?œê°„?€ ë°? elapsed=${elapsed.toFixed(2)}ì´? bgmStartTime=${bgmStartTime}ì´? bgmEndTime=${bgmEndTime}ì´?)
                previewBgmAudio.pause()
                previewBgmAudio.currentTime = 0
              }
            }
          }
        }

        // ?¨ê³¼???œê°„?€ ì²´í¬ ë°??¬ìƒ/?•ì? (previewSfxAudioë§??¬ìš©)
        if (previewSfxAudio && sfxUrl) {
          // duration??? íš¨?œì? ?•ì¸ (NaN, Infinity ì²´í¬)
          const sfxDuration = previewSfxAudio.duration
          if (isFinite(sfxDuration) && sfxDuration > 0) {
            // sfxEndTime???˜ì–´ê°”ê±°??sfxStartTime ?´ì „?´ê±°???¤ë””?¤ê? ?ë‚¬?¼ë©´ ë¬´ì¡°ê±??¨ê³¼???•ì?
            if (elapsed >= sfxEndTime || elapsed < sfxStartTime || elapsed >= audio.duration) {
              if (!previewSfxAudio.paused) {
                previewSfxAudio.pause()
                previewSfxAudio.currentTime = 0
              }
            } else if (elapsed >= sfxStartTime && elapsed < sfxEndTime && elapsed < audio.duration) {
              // ?¨ê³¼???¬ìƒ ?œê°„?€ ?´ì— ?ˆê³  ?¤ë””?¤ê? ?„ì§ ?ë‚˜ì§€ ?Šì•˜???Œë§Œ ?¬ìƒ
              const sfxOffset = elapsed - sfxStartTime
              const safeCurrentTime = Math.max(0, Math.min(sfxOffset, sfxDuration))
              
              if (previewSfxAudio.paused) {
                // ?¨ê³¼?Œì´ ?¼ì‹œ?•ì? ?íƒœë©??¬ìƒ ?œì‘
                if (isFinite(safeCurrentTime)) {
                  previewSfxAudio.currentTime = safeCurrentTime
                  previewSfxAudio.play().catch(() => {})
                }
              } else {
                // ?¨ê³¼?Œì´ ?¬ìƒ ì¤‘ì´ë©??œê°„ ?™ê¸°??(0.1ì´??´ìƒ ì°¨ì´?˜ë©´)
                if (Math.abs(previewSfxAudio.currentTime - safeCurrentTime) > 0.1) {
                  previewSfxAudio.currentTime = safeCurrentTime
                }
              }
            }
          }
        }

        // ?¤ë””?¤ê? ?ë‚¬?”ì? ?•ì¸
        if (audio.ended || elapsed >= audio.duration) {
          setIsPlaying(false)
          // ë¹„ë””???¼ì‹œ?•ì?
          if (previewVideoRef.current) {
            previewVideoRef.current.pause()
          }
          // BGM ?¼ì‹œ?•ì? ë°??•ì? (previewBgmAudioë§??¬ìš©)
          if (previewBgmAudio) {
            previewBgmAudio.pause()
            const bgmDuration = previewBgmAudio.duration
            if (isFinite(bgmDuration)) {
              previewBgmAudio.currentTime = 0
            }
          }
          // ?¨ê³¼???¼ì‹œ?•ì? ë°??•ì? (previewSfxAudioë§??¬ìš©)
          if (previewSfxAudio) {
            previewSfxAudio.pause()
            const sfxDuration = previewSfxAudio.duration
            if (isFinite(sfxDuration)) {
              previewSfxAudio.currentTime = 0
            }
          }
          return
        }

        // ?¸ë„¤???œê°„ ì²´í¬
        const THUMBNAIL_DURATION = 0.01 // 0.01ì´?        const elapsedMs = elapsed * 1000
        
        // ê°??ìƒ???œì‘ ?œê°„ ê³„ì‚°
        const videoStartTimes = [THUMBNAIL_DURATION]
        for (let i = 0; i < 3; i++) {
          const startTime = i === 0 
            ? THUMBNAIL_DURATION 
            : videoStartTimes[i] + videoDurations[i - 1]
          videoStartTimes.push(startTime)
        }
        
        // ?„ì¬ ?œê°„??ë§ëŠ” ?ìƒ ì°¾ê¸° ë°??™ê¸°??        let foundVideoIndex = -1
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
        
        // ?„ì¬ ?ìƒ ?¸ë±???…ë°?´íŠ¸
        if (foundVideoIndex !== currentVideoIndex) {
          setCurrentVideoIndex(foundVideoIndex)
        }
        
        // ?„ì¬ ?ìƒ ?™ê¸°??        if (foundVideoIndex >= 0 && videoElements[foundVideoIndex]) {
          const video = videoElements[foundVideoIndex]
          
          // video ref???„ì¬ ?ìƒ ?¤ì •
          if (previewVideoRef.current) {
            // ?ìƒ ?„í™˜ ê°ì?
            if (previewVideoRef.current.src !== video.src) {
              // ?ìƒ ë³€ê²?(?„í™˜ ?¨ê³¼ ìµœì†Œ??
              const wasPlaying = !previewVideoRef.current.paused
              
              previewVideoRef.current.src = video.src
              previewVideoRef.current.crossOrigin = video.crossOrigin
              previewVideoRef.current.muted = video.muted
              previewVideoRef.current.playsInline = video.playsInline
              previewVideoRef.current.loop = false
              
              // ?ìƒ??ì¤€ë¹„ë˜ë©?ì¦‰ì‹œ ?¬ìƒ
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
              
              // ë¹ ë¥¸ ?˜ì´???¨ê³¼ (ê±°ì˜ ì¦‰ì‹œ)
              setVideoTransitionOpacity(0.3)
              setTimeout(() => setVideoTransitionOpacity(1), 30)
            } else {
              // ê°™ì? ?ìƒ?´ë©´ ?œê°„ ?™ê¸°?”ë§Œ ?˜í–‰ (???•í™•?˜ê²Œ)
              if (Math.abs(previewVideoRef.current.currentTime - videoTime) > 0.05) {
                previewVideoRef.current.currentTime = videoTime
              }
              
              // ?¬ìƒ ë³´ì¥
              if (previewVideoRef.current.paused && !audio.paused) {
                previewVideoRef.current.play().catch(() => {})
              }
              
              // ?„í™˜ ?¨ê³¼ ?„ë£Œ ?•ì¸
              if (videoTransitionOpacity < 1) {
                setVideoTransitionOpacity(1)
              }
            }
          }
          
          // ë°±ê·¸?¼ìš´??ë¹„ë””???˜ë¦¬ë¨¼íŠ¸???™ê¸°??          if (!isNaN(video.duration) && video.duration > 0) {
            if (Math.abs(video.currentTime - videoTime) > 0.1) {
              video.currentTime = videoTime
            }
            if (video.paused && !audio.paused) {
              video.play().catch(() => {})
            }
          }
        } else {
          // ?¸ë„¤???œê°„?´ê±°???ìƒ ë²”ìœ„ë¥?ë²—ì–´??ê²½ìš°
          if (previewVideoRef.current && !audio.paused) {
            previewVideoRef.current.pause()
          }
          if (foundVideoIndex === -1) {
            setCurrentVideoIndex(-1)
            setPreviousVideoIndex(-1)
          }
        }

        // ?ë§‰ ?…ë°?´íŠ¸ (?¸ë„¤???œê°„ ?œì™¸)
        if (scriptLines.length > 0 && (!previewThumbnailImage || elapsed >= THUMBNAIL_DURATION)) {
          const currentLine = scriptLines.find(
            line => elapsedMs >= line.startTime && elapsedMs < line.endTime
          )
          
          if (currentLine) {
            // ?˜ë? ?¨ìœ„ë¡??˜ëˆ  ??ì¤„ì”© ?œì„œ?€ë¡?(?¼í‘œÂ·ë§ˆì¹¨??ê¸°ì?)
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

      // ë¯¸ë¦¬ë³´ê¸°???¤ë””??ë°?ë¹„ë””???¤ì • (3ê°??ìƒ)
      setPreviewAudio(audio)
      setPreviewVideoElements(videoElements)
            
      // video ref??ì²?ë²ˆì§¸ ?ìƒ ?¤ì • (ì´ˆê¸°ê°?
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
      console.log("[Shopping] ë¯¸ë¦¬ë³´ê¸° ?ì„± ?„ë£Œ (ë¡±í¼ ë°©ì‹)")
      alert("ë¯¸ë¦¬ë³´ê¸°ê°€ ?ì„±?˜ì—ˆ?µë‹ˆ?? ?¬ìƒ ë²„íŠ¼???ŒëŸ¬ ?•ì¸?˜ì„¸??")
    } catch (error) {
      const msg = error instanceof Error ? error.message : "?????†ëŠ” ?¤ë¥˜"
      console.error("ë¯¸ë¦¬ë³´ê¸° ?ì„± ?¤íŒ¨:", error)
      setError(`ë¯¸ë¦¬ë³´ê¸° ?ì„±???¤íŒ¨?ˆìŠµ?ˆë‹¤: ${msg}`)
      alert(`ë¯¸ë¦¬ë³´ê¸° ?ì„± ?¤íŒ¨\n\n${msg}\n\nSafari?ì„œ??WebM ?ìƒ??ì§€?ë˜ì§€ ?Šì„ ???ˆìŠµ?ˆë‹¤. Chrome ???¤ë¥¸ ë¸Œë¼?°ì??ì„œ ?œë„??ë³´ì„¸??`)
    } finally {
      setIsGeneratingPreview(false)
    }
  }

  // ë¯¸ë¦¬ë³´ê¸° ?¬ìƒ/?¼ì‹œ?•ì? (ë¡±í¼ ë°©ì‹: onTimeUpdate ?¬ìš©)
  const handlePreviewPlayPause = () => {
    if (!previewAudio) return

    if (isPlaying) {
      previewAudio.pause()
      // ë¹„ë””?¤ë„ ?¼ì‹œ?•ì?
      if (previewVideoRef.current) {
        previewVideoRef.current.pause()
      }
      // BGM ?¼ì‹œ?•ì?
      if (previewBgmAudio) {
        previewBgmAudio.pause()
      }
      // ?¨ê³¼???¼ì‹œ?•ì?
      if (previewSfxAudio) {
        previewSfxAudio.pause()
      }
      setIsPlaying(false)
    } else {
      previewAudio.play()
      setIsPlaying(true)
      
      // ë¹„ë””???¬ìƒ ?œì‘ (ë¡±í¼ ë°©ì‹: ?¨ìˆœ?˜ê²Œ)
      if (previewVideoRef.current) {
        previewVideoRef.current.loop = true
        previewVideoRef.current.currentTime = 0
        previewVideoRef.current.play().catch(() => {})
      }
      
      // ?¬ìƒ ?œì‘ ?œì ??BGMê³??¨ê³¼??ì²´í¬ ë°??¬ìƒ
      const elapsed = previewAudio.currentTime
      const audioDuration = previewAudio.duration
      
      // BGM ì²´í¬ ë°??¬ìƒ (ì¢…ë£Œ ?œê°„???˜ì–´ê°?ê²½ìš° ?¬ìƒ?˜ì? ?ŠìŒ)
      if (previewBgmAudio && bgmUrl && !previewAudio.ended && audioDuration > 0) {
        const bgmDuration = previewBgmAudio.duration
        if (isFinite(bgmDuration) && bgmDuration > 0) {
          // ì¢…ë£Œ ?œê°„???„ë‹¬?ˆê±°???˜ì–´ê°”ê±°???œì‘ ?œê°„ ?´ì „?´ë©´ ?¬ìƒ?˜ì? ?ŠìŒ (?„ê²©??ì²´í¬)
          // bgmEndTime???„ë‹¬?˜ë©´ ì¦‰ì‹œ ?•ì? (?? 10ì´ˆì— ?„ë‹¬?˜ë©´ ?•ì?)
          if (elapsed >= bgmEndTime || elapsed < bgmStartTime || elapsed >= audioDuration || previewAudio.ended) {
            // BGM???¬ìƒ ì¤‘ì´ë©??•ì?
            if (!previewBgmAudio.paused) {
              previewBgmAudio.pause()
              previewBgmAudio.currentTime = 0
            }
          } else if (elapsed >= bgmStartTime && elapsed < bgmEndTime && elapsed < audioDuration && !previewAudio.ended) {
            // BGM ?¬ìƒ ?œê°„?€ ?´ì— ?ˆì„ ?Œë§Œ ?¬ìƒ (elapsed < bgmEndTime - ì¢…ë£Œ ?œê°„???„ë‹¬?˜ë©´ ?¬ìƒ?˜ì? ?ŠìŒ)
            const bgmOffset = elapsed - bgmStartTime
            const safeCurrentTime = Math.max(0, Math.min(bgmOffset % bgmDuration, bgmDuration))
            if (isFinite(safeCurrentTime)) {
              previewBgmAudio.currentTime = safeCurrentTime
              previewBgmAudio.play().catch(() => {})
            }
          } else {
            // BGM ?¬ìƒ ?œê°„?€ ë°–ì´ë©?ë¬´ì¡°ê±??•ì?
            if (!previewBgmAudio.paused) {
              previewBgmAudio.pause()
              previewBgmAudio.currentTime = 0
            }
          }
        }
      }
      
      // ?¨ê³¼??ì²´í¬ ë°??¬ìƒ
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

  // blob??GCS(?í¼ ë²„í‚·)???…ë¡œ?????‘ê·¼ ê°€?¥í•œ URL ë°˜í™˜ (?œë²„ ?¤ìš´ë¡œë“œ??. ê· ì¼ ë²„í‚· ?˜ì? ?¡ì„¸???€?‘ìœ¼ë¡??½ê¸°??signed URL ?¬ìš©.
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
      throw new Error(err.error || `Signed URL ?¤íŒ¨: ${res.status}`)
    }
    const { signedUrl, fileName: storedFileName } = await res.json()
    const putRes = await fetch(signedUrl, { method: "PUT", body: blob, headers: { "Content-Type": contentType } })
    if (!putRes.ok) throw new Error("GCS ?…ë¡œ???¤íŒ¨")
    // ê· ì¼ ë²„í‚· ?˜ì? ?¡ì„¸?¤ì—?œëŠ” makePublic() ë¶ˆê? ???½ê¸°??signed URL ?¬ìš© (Cloud Run????URLë¡?fetch)
    const readRes = await fetch("/api/upload-to-gcs/signed-read-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: storedFileName, scope: "shopping" }),
    })
    if (!readRes.ok) {
      const err = await readRes.json().catch(() => ({}))
      throw new Error(err.error || "?½ê¸° URL ?ì„± ?¤íŒ¨")
    }
    const { readUrl } = await readRes.json()
    return readUrl
  }

  // ?œë²„ ?¤ìš´ë¡œë“œ: ë¯¸ë¦¬ë³´ê¸° ?°ì´??TTS, ?ë§‰, ?ìƒ3ê°? ?¸ë„¤?? BGM/?¨ê³¼??ë¥?Cloud Run?¼ë¡œ ë³´ë‚´ ?Œë” ???¤ìš´ë¡œë“œ
  const handleServerDownload = async () => {
    if (!previewGenerated || !previewAudio || convertedVideoUrls.size !== 3 || !ttsAudioUrl) {
      alert("ë¯¸ë¦¬ë³´ê¸°ë¥?ë¨¼ì? ?ì„±?˜ê³ , TTS?€ ?ìƒ 3ê°œê? ì¤€ë¹„ë˜???ˆì–´???©ë‹ˆ??")
      return
    }
    const durationSec = previewAudio.duration
    if (!isFinite(durationSec) || durationSec <= 0) {
      alert("?¤ë””??ê¸¸ì´ë¥??•ì¸?????†ìŠµ?ˆë‹¤. ë¯¸ë¦¬ë³´ê¸°ë¥??¤ì‹œ ?ì„±?´ì£¼?¸ìš”.")
      return
    }
    const thumbSrc = selectedThumbnailIndex >= 0 && thumbnailImages[selectedThumbnailIndex]
      ? thumbnailImages[selectedThumbnailIndex].url
      : thumbnailUrl || ""
    if (!thumbSrc) {
      alert("?¸ë„¤?¼ì„ ? íƒ?˜ê±°???ì„±?´ì£¼?¸ìš”.")
      return
    }
    if (scriptLines.length === 0) {
      alert("?ë§‰ ?°ì´?°ê? ?†ìŠµ?ˆë‹¤. ë¯¸ë¦¬ë³´ê¸°ë¥??¤ì‹œ ?ì„±?´ì£¼?¸ìš”.")
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
        if (!res.ok) throw new Error(`?¤ìš´ë¡œë“œ ?¤íŒ¨: ${url}`)
        return res.blob()
      }

      // 1) TTS ?¤ë””???…ë¡œ??      const ttsBlob = await getBlobFromUrl(ttsAudioUrl)
      const audioGcsUrl = await uploadBlobToGcsShopping(ttsBlob, "tts_audio", ttsBlob.type || "audio/mpeg")

      // 2) ?ìƒ 3ê°??…ë¡œ??      const videoUrls: string[] = []
      for (let i = 0; i < 3; i++) {
        const url = convertedVideoUrls.get(i)
        if (!url) throw new Error(`?ìƒ ${i + 1}???†ìŠµ?ˆë‹¤.`)
        const blob = await getBlobFromUrl(url)
        const gcsUrl = await uploadBlobToGcsShopping(blob, `segment_${i}`, blob.type || "video/webm")
        videoUrls.push(gcsUrl)
      }

      // 3) ?¸ë„¤???…ë¡œ??      const thumbBlob = await getBlobFromUrl(thumbSrc)
      const thumbnailImageUrl = await uploadBlobToGcsShopping(thumbBlob, "thumbnail", thumbBlob.type || "image/jpeg")

      // 4) BGM / ?¨ê³¼??(? íƒ)
      let bgmGcsUrl: string | null = null
      let sfxGcsUrl: string | null = null
      if (bgmUrl) {
        try {
          const b = await getBlobFromUrl(bgmUrl)
          bgmGcsUrl = await uploadBlobToGcsShopping(b, "bgm", b.type || "audio/mpeg")
        } catch (e) {
          console.warn("[?œë²„ ?¤ìš´ë¡œë“œ] BGM ?…ë¡œ???¤íŒ¨, BGM ?†ì´ ì§„í–‰:", e)
        }
      }
      if (sfxUrl) {
        try {
          const b = await getBlobFromUrl(sfxUrl)
          sfxGcsUrl = await uploadBlobToGcsShopping(b, "sfx", b.type || "audio/mpeg")
        } catch (e) {
          console.warn("[?œë²„ ?¤ìš´ë¡œë“œ] ?¨ê³¼???…ë¡œ???¤íŒ¨, ?¨ê³¼???†ì´ ì§„í–‰:", e)
        }
      }

      // ë¯¸ë¦¬ë³´ê¸°ì²˜ëŸ¼ TTS??ë§ì¶° ??ì¤?phrase)???œê°„?€ë¡??„ë‹¬ (getSubtitlePhrasesë¡??˜ëˆˆ ??êµ¬ê°„ë³?start/end ë¶€??
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
        throw new Error(errData.error || `?Œë” ?”ì²­ ?¤íŒ¨: ${renderRes.status}`)
      }
      const result = await renderRes.json()
      const videoUrl = result.videoUrl
      const videoBase64 = result.videoBase64

      let blob: Blob
      if (videoUrl) {
        const videoRes = await fetch(videoUrl)
        if (!videoRes.ok) throw new Error("?Œë”???ìƒ ?¤ìš´ë¡œë“œ ?¤íŒ¨")
        blob = await videoRes.blob()
      } else if (videoBase64) {
        const binary = atob(videoBase64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        blob = new Blob([bytes], { type: "video/mp4" })
      } else {
        throw new Error("?‘ë‹µ??videoUrl ?ëŠ” videoBase64ê°€ ?†ìŠµ?ˆë‹¤.")
      }

      // ?¬ìš©??ê¸°ê¸°ë¡??ìƒ ?€??(ëª¨ë°”???¸ì•±: ê³µìœ Â·??ì°½Â·í™”ë©?ë§í¬, PC: ?¤ìš´ë¡œë“œ)
      const fileName = `${(factoryAutoRunItem?.productName || productName) || "shopping"}_server_${Date.now()}.mp4`
      const downloadUrl = URL.createObjectURL(blob)
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
      const inAppBrowser = /NAVER|Naver|KAKAOTALK|Daum|FBAN|FBAV/i.test(ua)
      const mobile = typeof navigator !== "undefined" && (inAppBrowser || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || (typeof window !== "undefined" && window.innerWidth <= 768))
      if (mobile) {
        // ëª¨ë°”?¼Â·ì¸?? ?”ë©´??'?ìƒ ?€?? ë§í¬ ??ƒ ?œì‹œ (?¤ì´ë²????¸ì•±?ì„œ???ë™ ?¤ìš´ë¡œë“œê°€ ë§‰í˜)
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
            await share({ files: [file], title: fileName, text: "?Œë”ë§ëœ ?ìƒ" })
            if (!factoryAutoRunItem) alert("ê³µìœ  ?”ë©´?ì„œ '?€?? ?ëŠ” '?Œì¼???€????? íƒ?˜ì„¸??")
          } catch (e) {
            if ((e as Error)?.name !== "AbortError") {
              window.open(downloadUrl, "_blank")
              if (!factoryAutoRunItem) alert("?ìƒ????ì°½ì—???´ë ¸?????ˆìŠµ?ˆë‹¤.\n???˜ë©´ ?„ë˜ '?ìƒ ?€?? ë²„íŠ¼???ŒëŸ¬ ì£¼ì„¸??")
            }
          }
        } else {
          window.open(downloadUrl, "_blank")
        }
        if (!factoryAutoRunItem) {
          if (inAppBrowser) {
            alert("?œë²„ ?Œë”ë§ì´ ?„ë£Œ?˜ì—ˆ?µë‹ˆ??\n\n?„ë˜ '?ìƒ ?€?? ë²„íŠ¼???ŒëŸ¬ ?€?¥í•´ ì£¼ì„¸?? ?€?¥ì´ ???˜ë©´ Chrome ?ëŠ” Safari?ì„œ ???˜ì´ì§€ë¥??´ì–´ ?¤ì‹œ ?œë„??ì£¼ì„¸??")
          } else {
            alert("?œë²„ ?Œë”ë§ì´ ?„ë£Œ?˜ì—ˆ?µë‹ˆ??\n?„ë˜ '?ìƒ ?€?? ë²„íŠ¼???ŒëŸ¬ ì£¼ì„¸??")
          }
        }
      } else {
        const a = document.createElement("a")
        a.href = downloadUrl
        a.download = fileName
        a.click()
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000)
        if (!factoryAutoRunItem) alert("?œë²„ ?Œë”ë§ì´ ?„ë£Œ?˜ì—ˆ?µë‹ˆ?? ?¤ìš´ë¡œë“œê°€ ?œì‘?©ë‹ˆ??")
      }

      // ?ë™??ëª¨ë“œ ëª¨ë“œ: ?œë²„?ì„œ ë°›ì? ?ìƒ?¼ë¡œ ?€????? íŠœë¸??ë™ ?…ë¡œ??      if (factoryAutoRunItem) {
        await saveShotFormScheduleVideoBlob(factoryAutoRunItem.id, blob)
        let youtubeUploaded = false
        // ?…ë¡œ?????œëª©Â·?¤ëª…??ë¹„ì–´ ?ˆìœ¼ë©?ë¯¸ë¦¬ ?ì„± (?ë™ ì§„í–‰ ??stateê°€ ë¹„ì–´ ?ˆì„ ???ˆìŒ)
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
            console.warn("[Factory] ? íŠœë¸?ë©”í??°ì´???ì„± ?¤íŒ¨:", metaErr)
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
            alert(`? íŠœë¸??ˆì•½ ?…ë¡œ?œê? ?„ë£Œ?˜ì—ˆ?µë‹ˆ??\n${uploadData.message || ""}`)
          } else {
            alert(`? íŠœë¸??…ë¡œ???¤íŒ¨: ${uploadData.error || uploadRes.statusText}`)
          }
          } catch (e) {
            alert(`? íŠœë¸??ë™ ?…ë¡œ??ì¤??¤ë¥˜: ${e instanceof Error ? e.message : "?????†ìŒ"}`)
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
          alert("ê³µì¥ ?ˆì•½ ?„ë£Œ. ?ë™??ëª¨ë“œ ëª©ë¡?ì„œ ?¤ìš´ë¡œë“œ?????ˆìŠµ?ˆë‹¤.")
        }
      }

      // ?ë™??ëª¨ë“œ ëª¨ë“œ?€?¼ë©´ ?„ë£Œ ??ëª©ë¡?¼ë¡œ
      if (factoryAutoRunItem) {
        setFactoryAutoRunItem(null)
        setShowProjectList(true)
        setShowFactoryView(true)
      }
    } catch (err) {
      console.error("[?œë²„ ?¤ìš´ë¡œë“œ] ?¤íŒ¨:", err)
      const msg = err instanceof Error ? err.message : String(err)
      setError(`?œë²„ ?¤ìš´ë¡œë“œ ?¤íŒ¨: ${msg}`)
      alert(`?œë²„ ?¤ìš´ë¡œë“œ???¤íŒ¨?ˆìŠµ?ˆë‹¤.\n\n${msg}`)
    } finally {
      setIsServerDownloading(false)
    }
  }

  // ìµœì¢… ?ìƒ ?Œë”ë§?(ë¯¸ë¦¬ë³´ê¸°?€ ?™ì¼). ?ˆì•½ ë°œí–‰ ??onCompleteë¡?blob ?„ë‹¬ ???€??
  const handleRenderVideo = async (options?: { onComplete?: (blob: Blob) => void }) => {
    // 3ê°œì˜ ê°œë³„ ?ìƒ??ëª¨ë‘ ì¤€ë¹„ë˜?´ì•¼ ??    if (convertedVideoUrls.size !== 3 || !ttsAudioUrl || !canvasRef.current) {
      alert("3ê°œì˜ ?ìƒê³?TTSê°€ ëª¨ë‘ ì¤€ë¹„ë˜?´ì•¼ ?©ë‹ˆ??")
      return
    }
    
    if (!previewGenerated || !previewAudio) {
      alert("ë¨¼ì? ë¯¸ë¦¬ë³´ê¸°ë¥??ì„±?´ì£¼?¸ìš”.")
      return
    }

    setIsRendering(true)
    setError("")
    try {
      console.log("[Shopping] ìµœì¢… ?ìƒ ?Œë”ë§??œì‘ (ë¯¸ë¦¬ë³´ê¸°?€ ?™ì¼??ë°©ì‹)")

      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        throw new Error("Canvas contextë¥??ì„±?????†ìŠµ?ˆë‹¤.")
      }

      // Canvas ?¬ê¸°ë¥?1080x1920?¼ë¡œ ?¤ì •
      canvas.width = 1080
      canvas.height = 1920

      // ë¯¸ë¦¬ë³´ê¸°?ì„œ ?¬ìš©?˜ëŠ” ?¤ë””???¬ì‚¬??      const audio = previewAudio
      
      // ?¤ë””???œê°„ ì´ˆê¸°??      audio.currentTime = 0
      const actualAudioDuration = audio.duration
      console.log("[Shopping] ?¤ì œ ?¤ë””??ê¸¸ì´:", actualAudioDuration.toFixed(3), "ì´?)

      // 3ê°œì˜ ê°œë³„ ?ìƒ ?˜ë¦¬ë¨¼íŠ¸ ?ì„± ë°?ë¡œë“œ
      const videoElements: HTMLVideoElement[] = []
      const videoDurations: number[] = []
      
      // TTS ê¸¸ì´ë¥?3?¼ë¡œ ?˜ëˆˆ ê°?ê³„ì‚°
      const durationPerVideo = Math.round(actualAudioDuration / 3)
      
      for (let i = 0; i < 3; i++) {
        const videoUrl = convertedVideoUrls.get(i)
        if (!videoUrl) {
          throw new Error(`?ìƒ ${i + 1}??ì¤€ë¹„ë˜ì§€ ?Šì•˜?µë‹ˆ??`)
        }
        
        const video = document.createElement("video")
        video.src = videoUrl
        video.crossOrigin = "anonymous"
        // ëª¨ë°”?¼ì—?????˜ì? ë²„í¼ë§ì„ ?„í•´ preload ?¤ì •
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                        (typeof window !== "undefined" && window.innerWidth <= 768)
        video.preload = isMobile ? "metadata" : "auto"
        video.muted = true
        video.playsInline = true
        
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => {
            const duration = video.duration || durationPerVideo
            videoDurations.push(duration)
            console.log(`[Shopping] ?ìƒ ${i + 1} ë¡œë“œ ?„ë£Œ, ê¸¸ì´: ${duration.toFixed(2)}ì´?)
            resolve()
          }
          // ëª¨ë°”?¼ì—??ë²„í¼ë§?ê°œì„ 
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
          
          // ëª¨ë°”?¼ì—?œëŠ” ?€?„ì•„?ƒì„ ??ê¸¸ê²Œ
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

      console.log("[Shopping] 3ê°??ìƒ ë¡œë“œ ?„ë£Œ, ê°??ìƒ ê¸¸ì´:", videoDurations.map(d => d.toFixed(2) + "ì´?))

      // MediaRecorder ?¤ì • (ë¡±í¼ ?¼ì¸  ?ì„±ê¸?ë°©ì‹)
      // ë¶€?œëŸ¬???Œë”ë§ì„ ?„í•´ 30fpsë¡??¤ì •
      const stream = canvas.captureStream(30)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const source = audioContext.createMediaElementSource(audio)
      
      // TTS ë³¼ë¥¨ ì¡°ì ˆ
      const ttsGainNode = audioContext.createGain()
      ttsGainNode.gain.value = ttsVolume
      source.connect(ttsGainNode)
      
      // BGM ì¶”ê? (?ˆëŠ” ê²½ìš°) - bgmUrlë§??ˆìœ¼ë©?ì¶”ê? (?Œì¼ ?…ë¡œ???ëŠ” ?¼ì´ë¸ŒëŸ¬ë¦?? íƒ ëª¨ë‘)
      let bgmGainNode: GainNode | null = null
      let bgmSource: MediaElementAudioSourceNode | null = null
      let bgmAudioElement: HTMLAudioElement | null = null
      if (bgmUrl) {
        bgmAudioElement = new Audio(bgmUrl)
        bgmAudioElement.loop = false // ?œê°„?€??ë§ê²Œ ?¬ìƒ?˜ë?ë¡?loop ?´ì œ
        bgmAudioElement.volume = bgmVolume
        bgmAudioElement.preload = "auto"
        bgmAudioElement.crossOrigin = "anonymous"
        
        // BGM ?¤ë””??ë¡œë“œ ?€ê¸?        await new Promise<void>((resolve, reject) => {
          if (!bgmAudioElement) {
            resolve()
            return
          }
          bgmAudioElement.onloadeddata = () => {
            console.log("[Shopping] BGM ë¡œë“œ ?„ë£Œ")
            resolve()
          }
          bgmAudioElement.onerror = (e) => {
            console.warn("[Shopping] BGM ë¡œë“œ ?¤íŒ¨, ê³„ì† ì§„í–‰:", e)
            bgmAudioElement = null
            resolve() // BGM???†ì–´??ê³„ì† ì§„í–‰
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
      
      // ?¨ê³¼??ì¶”ê? (?ˆëŠ” ê²½ìš°)
      let sfxGainNode: GainNode | null = null
      let sfxSource: MediaElementAudioSourceNode | null = null
      let sfxAudioElement: HTMLAudioElement | null = null
      if (sfxUrl) {
        sfxAudioElement = new Audio(sfxUrl)
        sfxAudioElement.loop = false
        sfxAudioElement.volume = sfxVolume
        sfxAudioElement.preload = "auto"
        sfxAudioElement.crossOrigin = "anonymous"
        
        // ?¨ê³¼???¤ë””??ë¡œë“œ ?€ê¸?        await new Promise<void>((resolve, reject) => {
          if (!sfxAudioElement) {
            resolve()
            return
          }
          sfxAudioElement.onloadeddata = () => {
            console.log("[Shopping] ?¨ê³¼??ë¡œë“œ ?„ë£Œ")
            resolve()
          }
          sfxAudioElement.onerror = (e) => {
            console.warn("[Shopping] ?¨ê³¼??ë¡œë“œ ?¤íŒ¨, ê³„ì† ì§„í–‰:", e)
            sfxAudioElement = null
            resolve() // ?¨ê³¼?Œì´ ?†ì–´??ê³„ì† ì§„í–‰
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

      // ë¶€?œëŸ¬???Œë”ë§ì„ ?„í•œ MediaRecorder ?¤ì • (Safari/iOS??vp9 ë¯¸ì??????´ë°±?¼ë¡œ ?Šê? ë°©ì?)
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
          console.log("[Shopping] ?ìƒ ?Œë”ë§??„ë£Œ (?ˆì•½ ë°œí–‰ ?€?¥ìš©)")
          setIsRendering(false)
          return
        }
        const videoUrlForDownload = URL.createObjectURL(videoBlob)
        // ëª¨ë°”??ê¸°ê¸° ê°ì?
        const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                      (window.innerWidth <= 768)
        if (mobile) {
          console.log("[Shopping] ?ìƒ ?Œë”ë§??„ë£Œ (ëª¨ë°”??")
          setVideoUrl(videoUrlForDownload)
          setIsRendering(false)
          alert("?ìƒ ?Œë”ë§ì´ ?„ë£Œ?˜ì—ˆ?µë‹ˆ??\n\n?¤ìš´ë¡œë“œ ë²„íŠ¼???ŒëŸ¬ ?ìƒ???€?¥í•˜?¸ìš”.")
        } else {
        const a = document.createElement("a")
          a.href = videoUrlForDownload
        a.download = `${productName || "shopping"}_video_${Date.now()}.webm`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
          setTimeout(() => URL.revokeObjectURL(videoUrlForDownload), 1000)
        console.log("[Shopping] ?ìƒ ?Œë”ë§?ë°??¤ìš´ë¡œë“œ ?„ë£Œ")
        setIsRendering(false)
        }
      }

      // ?¸ë„¤???´ë?ì§€ ë¡œë“œ (?ˆëŠ” ê²½ìš°) - ë¯¸ë¦¬ë³´ê¸°?ì„œ ?¬ìš©??ê²??¬ì‚¬??      let thumbnailImage: HTMLImageElement | null = previewThumbnailImage

      // AudioContextê°€ suspended ?íƒœë©?resume
      if (audioContext.state === "suspended") {
        await audioContext.resume()
        console.log("[Shopping] AudioContext resumed")
      }

      // ?Œë”ë§??œì‘ (ë¡±í¼ ?¼ì¸  ?ì„±ê¸?ë°©ì‹)
      mediaRecorder.start()
      audio.play()
      
      // BGMê³??¨ê³¼?Œì´ AudioContextë¥??µí•´ ?¬ìƒ?˜ë„ë¡??•ì¸
      console.log("[Shopping] ?Œë”ë§??œì‘ - BGM:", bgmUrl ? "?ˆìŒ" : "?†ìŒ", "?¨ê³¼??", sfxUrl ? "?ˆìŒ" : "?†ìŒ")

      // ë¡±í¼ ?¼ì¸  ?ì„±ê¸?ë°©ì‹?¼ë¡œ ?Œë”ë§?(?¸ë„¤??+ 3ê°??ìƒ ?œì°¨ ?¬ìƒ)
      // ë¯¸ë¦¬ë³´ê¸°?€ ?„ì „???™ì¼??ë¡œì§ ?¬ìš©
      const THUMBNAIL_DURATION = 0.0001 // ë¯¸ë¦¬ë³´ê¸°?€ ?™ì¼?˜ê²Œ 0.0001ì´?      let scriptLinesToUse = scriptLines

      // ê°??ìƒ???œì‘ ?œê°„ ê³„ì‚° (ë¯¸ë¦¬ë³´ê¸°?€ ?™ì¼??ë°©ì‹)
      let accumulatedTime = 0
      const videoStartTimes: number[] = []
      for (let i = 0; i < videoDurations.length; i++) {
        videoStartTimes.push(accumulatedTime)
        accumulatedTime += videoDurations[i]
      }

      console.log("[Shopping] ?Œë”ë§?- ê°??ìƒ???œì‘ ?œê°„:", videoStartTimes.map(t => t.toFixed(2) + "ì´?))

      let lastVideoIndex = -1 // ë¯¸ë¦¬ë³´ê¸°?€ ?™ì¼?˜ê²Œ lastVideoIndex ?¬ìš©

      const renderFrame = () => {
        const elapsed = audio.currentTime

        // BGM ?œê°„?€ ì²´í¬ ë°??¬ìƒ/?•ì? (?Œë”ë§?ì¤‘ì—???™ê¸°??
        if (bgmAudioElement && bgmUrl) {
          // bgmEndTime???˜ì–´ê°”ê±°??bgmStartTime ?´ì „?´ë©´ ë¬´ì¡°ê±??•ì?
          if (elapsed >= bgmEndTime || elapsed < bgmStartTime) {
            if (!bgmAudioElement.paused) {
              bgmAudioElement.pause()
              bgmAudioElement.currentTime = 0
            }
          } else if (elapsed >= bgmStartTime && elapsed < bgmEndTime) {
            // BGM ?¬ìƒ ?œê°„?€ ?´ì— ?ˆì„ ?Œë§Œ ?¬ìƒ
            if (bgmAudioElement.paused) {
              // BGM ?œì‘ ?œê°„??ë§ì¶° ?¤ë””???„ì¹˜ ?¤ì •
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
              // ?¬ìƒ ì¤‘ì¼ ?Œë„ ?œê°„ ?™ê¸°??(0.1ì´??´ìƒ ì°¨ì´?˜ë©´)
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

        // ?¨ê³¼???œê°„?€ ì²´í¬ ë°??¬ìƒ/?•ì? (?Œë”ë§?ì¤‘ì—???™ê¸°??
        if (sfxAudioElement && sfxUrl) {
          if (elapsed >= sfxStartTime && elapsed < sfxEndTime) {
            // ?¨ê³¼???¬ìƒ ?œê°„?€ ?´ì— ?ˆì„ ?Œë§Œ ?¬ìƒ
            if (sfxAudioElement.paused) {
              // ?¨ê³¼???œì‘ ?œê°„??ë§ì¶° ?¤ë””???„ì¹˜ ?¤ì •
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
            // ?¨ê³¼???œê°„?€ ë°–ì´ë©??•ì?
            if (!sfxAudioElement.paused) {
              sfxAudioElement.pause()
              sfxAudioElement.currentTime = 0
            }
          }
        }

        // ìº”ë²„??ì´ˆê¸°??        ctx.fillStyle = "black"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // ?¸ë„¤?¼ì´ ?ˆê³  0.0001ì´??´í•˜?????¸ë„¤???œì‹œ (ë¯¸ë¦¬ë³´ê¸°?€ ?™ì¼)
        const adjustedElapsed = Math.max(0, elapsed - THUMBNAIL_DURATION) // ë¯¸ë¦¬ë³´ê¸°?€ ?™ì¼?˜ê²Œ adjustedElapsed ?¬ìš©
        
        if (thumbnailImage && elapsed < THUMBNAIL_DURATION) {
          ctx.drawImage(thumbnailImage, 0, 0, canvas.width, canvas.height)
        } else {
          // ?¸ë„¤???œê°„??ì§€?˜ë©´ ê¸°ì¡´ ?ìƒ ?œì‹œ (ë¯¸ë¦¬ë³´ê¸°?€ ?™ì¼)
          // ?„ì¬ ?œê°„??ë§ëŠ” ?ìƒ ì°¾ê¸° (?¸ë„¤???œê°„ ?œì™¸)
          let currentVideoIndex = -1
          for (let i = 0; i < videoStartTimes.length; i++) {
            const startTime = videoStartTimes[i]
            const endTime = i < videoStartTimes.length - 1 ? videoStartTimes[i + 1] : startTime + videoDurations[i]
            
            if (adjustedElapsed >= startTime && adjustedElapsed < endTime) {
              currentVideoIndex = i
              break
            }
          }

          // ë¹„ë””???„í™˜ ?œì—ë§?ì²˜ë¦¬ (ë¯¸ë¦¬ë³´ê¸°?€ ?™ì¼)
          if (currentVideoIndex !== lastVideoIndex) {
            // ?´ì „ ë¹„ë””???¼ì‹œ?•ì?
            if (lastVideoIndex >= 0 && videoElements[lastVideoIndex]) {
              videoElements[lastVideoIndex].pause()
              videoElements[lastVideoIndex].currentTime = 0
            }
            
            // ??ë¹„ë””???¬ìƒ ?œì‘
            if (currentVideoIndex >= 0 && videoElements[currentVideoIndex]) {
              const video = videoElements[currentVideoIndex]
              const videoStartTime = videoStartTimes[currentVideoIndex]
              const videoElapsed = adjustedElapsed - videoStartTime
              
              if (video && !isNaN(video.duration) && video.duration > 0) {
                // ?œì‘ ?œê°„ ?¤ì •
                video.currentTime = Math.max(0, Math.min(videoElapsed, video.duration))
                // ë¹„ë””???¬ìƒ (?ì²´?ìœ¼ë¡??¬ìƒ?˜ë„ë¡?
                video.play().catch(() => {})
              }
            }
            
            lastVideoIndex = currentVideoIndex
          }

          // ?„ì¬ ?ìƒ??ìº”ë²„?¤ì— ê·¸ë¦¬ê¸?(?Œë”ë§?ìµœì ?? ë§??„ë ˆ?„ë§ˆ???™ê¸°?? ë¹„ìœ¨ ? ì?)
          if (currentVideoIndex >= 0 && videoElements[currentVideoIndex]) {
            const currentVideo = videoElements[currentVideoIndex]
            const videoStartTime = videoStartTimes[currentVideoIndex]
            const videoElapsed = adjustedElapsed - videoStartTime
            
            // ?Œë”ë§??œì—??ë§??„ë ˆ?„ë§ˆ??ë¹„ë””???œê°„???¤ë””?¤ì— ë§ì¶° ?™ê¸°??(ë¶€?œëŸ¬???¬ìƒ???„í•´)
            if (currentVideo && !isNaN(currentVideo.duration) && currentVideo.duration > 0) {
              const targetTime = Math.max(0, Math.min(videoElapsed, currentVideo.duration))
              // ?œê°„ ì°¨ì´ê°€ 0.1ì´??´ìƒ?´ë©´ ?™ê¸°??(?ˆë¬´ ?ì£¼ ?¤ì •?˜ì? ?Šë„ë¡?
              if (Math.abs(currentVideo.currentTime - targetTime) > 0.1) {
                currentVideo.currentTime = targetTime
              }
              
              // ë¹„ë””?¤ê? ?¼ì‹œ?•ì??˜ì–´ ?ˆìœ¼ë©??¬ìƒ
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
                
                // ë¹„ë””?¤ì? ìº”ë²„?¤ì˜ ë¹„ìœ¨ ê³„ì‚°
                const videoAspect = videoWidth / videoHeight
                const canvasAspect = canvasWidth / canvasHeight
                
                let drawWidth = canvasWidth
                let drawHeight = canvasHeight
                let drawX = 0
                let drawY = 0
                
                // ë¹„ìœ¨??ë§ì¶° ì¤‘ì•™ ?¬ë¡­ (cover ë°©ì‹)
                if (videoAspect > canvasAspect) {
                  // ë¹„ë””?¤ê? ???“ìŒ - ?’ì´??ë§ì¶”ê³?ì¢Œìš° ?¬ë¡­
                  drawHeight = canvasHeight
                  drawWidth = drawHeight * videoAspect
                  drawX = (canvasWidth - drawWidth) / 2
                } else {
                  // ë¹„ë””?¤ê? ???’ìŒ - ?ˆë¹„??ë§ì¶”ê³??í•˜ ?¬ë¡­
                  drawWidth = canvasWidth
                  drawHeight = drawWidth / videoAspect
                  drawY = (canvasHeight - drawHeight) / 2
                }
                
                ctx.drawImage(currentVideo, 0, 0, videoWidth, videoHeight, drawX, drawY, drawWidth, drawHeight)
              }
            } catch (e) {
              // ê·¸ë¦¬ê¸??¤íŒ¨ ??ë¬´ì‹œ
            }
          }
        }

        // ?ë§‰ ê·¸ë¦¬ê¸?(?¸ë„¤???œê°„ ?™ì•ˆ?ëŠ” ?œì‹œ?˜ì? ?ŠìŒ) - ë¯¸ë¦¬ë³´ê¸°?€ ?™ì¼
        if (scriptLinesToUse.length > 0 && (!thumbnailImage || elapsed >= THUMBNAIL_DURATION)) {
          const elapsedMs = adjustedElapsed * 1000 // adjustedElapsed ?¬ìš©
          const currentLine = scriptLinesToUse.find(
            line => elapsedMs >= line.startTime && elapsedMs < line.endTime
          )
          
          if (currentLine) {
            // ?˜ë? ?¨ìœ„ë¡??˜ëˆ  ??ì¤„ì”© ?œì„œ?€ë¡?(?¼í‘œÂ·ë§ˆì¹¨??ê¸°ì?)
            const phrases = getSubtitlePhrases(currentLine.text)
            const lineDuration = currentLine.endTime - currentLine.startTime
            const timeInLine = elapsedMs - currentLine.startTime
            const phraseIndex = phrases.length <= 1 ? 0 : Math.min(Math.floor((timeInLine / lineDuration) * phrases.length), phrases.length - 1)
            const textToShow = phrases[phraseIndex] || currentLine.text
            // ?ë§‰ ?„ì¹˜ ê³„ì‚° (subtitleStyle ?¤ì • ë°˜ì˜)
            // ìº”ë²„???¬ê¸°: 1080x1920, ë¯¸ë¦¬ë³´ê¸° ?¬ê¸°: 533px ê¸°ì?
            // ë¯¸ë¦¬ë³´ê¸°?ì„œ??fontSize * 0.6???¬ìš©?˜ë?ë¡? ?Œë”ë§ì—?œë„ ?™ì¼??ë¹„ìœ¨ ?ìš©
            const previewHeight = 533 // ë¯¸ë¦¬ë³´ê¸° ?’ì´ (px)
            const scaleFactor = canvas.height / previewHeight // ?¤ì????©í„° ê³„ì‚°
            let baseY: number
            if (subtitleStyle.position === "top") {
              baseY = canvas.height * 0.15
            } else if (subtitleStyle.position === "center") {
              baseY = canvas.height * 0.5
            } else {
              baseY = canvas.height * 0.85
            }
            // positionOffset??ìº”ë²„???¬ê¸°??ë§ê²Œ ?¤ì??¼ë§
            const offsetY = subtitleStyle.positionOffset * scaleFactor
            const subtitleY = baseY + offsetY
            
            // ?ë§‰ ?¤í????ìš© (ë¯¸ë¦¬ë³´ê¸°?€ ?™ì¼??ë¹„ìœ¨: fontSize * 0.6 * scaleFactor)
            const fontSize = subtitleStyle.fontSize * 0.6 * scaleFactor
            ctx.font = `${subtitleStyle.fontWeight} ${fontSize}px '${subtitleStyle.fontFamily}', sans-serif`
            ctx.textAlign = subtitleStyle.textAlign
            ctx.textBaseline = "middle"
            
            // ?ìŠ¤???¬ê¸° ì¸¡ì • (ë°°ê²½ ê·¸ë¦¬ê¸°ìš©)
            const textMetrics = ctx.measureText(textToShow)
            const textWidth = textMetrics.width
            const textHeight = fontSize
            const padding = fontSize * 0.2 // ?¨ë”© ê³„ì‚°
            
            // ë°°ê²½ ê·¸ë¦¬ê¸?(backgroundColorê°€ ?¬ëª…?„ê? ?ˆìœ¼ë©?
            if (subtitleStyle.backgroundColor && subtitleStyle.backgroundColor !== "transparent") {
              const bgColor = subtitleStyle.backgroundColor
              ctx.fillStyle = bgColor
              
              // ?ìŠ¤???•ë ¬???°ë¼ ë°°ê²½ ?„ì¹˜ ì¡°ì •
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
              
              // ?¥ê·¼ ëª¨ì„œë¦?ë°°ê²½ (ê°„ë‹¨???¬ê°?•ìœ¼ë¡??€ì²?
              ctx.fillRect(bgX, bgY, bgWidth, bgHeight)
            }
            
            // ?ìŠ¤??ê·¸ë¦¼??(textShadowê°€ true??ê²½ìš°)
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
            
            // ?ìŠ¤???•ë ¬???°ë¼ X ?„ì¹˜ ê³„ì‚°
            let textX: number
            if (subtitleStyle.textAlign === "center") {
              textX = canvas.width / 2
            } else if (subtitleStyle.textAlign === "right") {
              textX = canvas.width - padding
            } else {
              textX = padding
            }
            
            // ?ë§‰ ?ìŠ¤??ê·¸ë¦¬ê¸?            ctx.fillStyle = subtitleStyle.color
            ctx.fillText(textToShow, textX, subtitleY)
          }
        }

        // ?¤ìŒ ?„ë ˆ???”ì²­ (ë¡±í¼ ?¼ì¸  ?ì„±ê¸?ë°©ì‹)
        if (!audio.paused && elapsed < actualAudioDuration) {
          requestAnimationFrame(renderFrame)
        } else {
          // ?Œë”ë§?ì¢…ë£Œ ??BGM ë°??¨ê³¼???•ë¦¬
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
      console.error("?ìƒ ?Œë”ë§??¤íŒ¨:", error)
      setError(`?ìƒ ?Œë”ë§ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤: ${error instanceof Error ? error.message : "?????†ëŠ” ?¤ë¥˜"}`)
      setIsRendering(false)
    }
  }

  // 1ê°??´ë?ì§€ë¥?3ë¶„í•  ?ìƒ?¼ë¡œ ë³€??(?œí’ˆ?ìƒ 4ì´? ?•ë??ìƒ 4ì´? ?¤ë¥¸ ê°ë„ 4ì´?
  const handleConvertAllImagesToVideos = async () => {
    if (imageUrls.length !== 3) {
      alert("?´ë?ì§€ 3ê°œê? ì¤€ë¹„ë˜?´ì•¼ ?©ë‹ˆ??")
      return
    }

    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined
    const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined

    if (!replicateApiKey) {
      alert("Replicate API ?¤ê? ?„ìš”?©ë‹ˆ?? ë©”ì¸ ?”ë©´???¤ì •(?±ë‹ˆë°”í€??„ì´ì½??ì„œ API ?¤ë? ?…ë ¥?´ì£¼?¸ìš”.")
      return
    }

    // ì¦‰ì‹œ ë¡œë”© ?íƒœ ?œì‹œ (ëª¨ë“  ?ìƒ???€??
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
      // TTS ê¸¸ì´ ê³„ì‚° (?¤ë””??ë©”í??°ì´?°ë? ?°ì„  ?¬ìš©)
      let totalTtsDuration = 12 // ê¸°ë³¸ê°?12ì´?      
      // 1?œìœ„: ?¤ë””??ë©”í??°ì´???¬ìš© (ê°€???•í™•??
      if (ttsAudioUrl) {
        try {
          const audio = new Audio(ttsAudioUrl)
          await new Promise((resolve, reject) => {
            audio.onloadedmetadata = () => {
              totalTtsDuration = Math.ceil(audio.duration)
              console.log(`[Shopping] ??TTS ê¸¸ì´: ${totalTtsDuration}ì´?(?¤ë””??ë©”í??°ì´??ê¸°ë°˜, ?¤ì œ ê¸¸ì´: ${audio.duration.toFixed(2)}ì´?`)
              resolve(undefined)
            }
            audio.onerror = reject
            audio.load()
          })
        } catch (audioError) {
          console.warn("[Shopping] TTS ?¤ë””??ê¸¸ì´ ê°€?¸ì˜¤ê¸??¤íŒ¨, scriptLines ?¬ìš©:", audioError)
        }
      }
      
      // 2?œìœ„: scriptLines ?¬ìš© (?¤ë””??ë©”í??°ì´?°ê? ?†ì„ ?Œë§Œ)
      if (totalTtsDuration === 12 && scriptLines && scriptLines.length > 0) {
        const lastLine = scriptLines[scriptLines.length - 1]
        const scriptLinesDuration = Math.ceil(lastLine.endTime / 1000)
        // scriptLines??endTime??ë¹„ì •?ì ?¼ë¡œ ?¬ë©´ ë¬´ì‹œ (?? 37ì´?
        if (scriptLinesDuration <= 60) { // ìµœë? 60ì´ˆê¹Œì§€ë§??ˆìš©
          totalTtsDuration = scriptLinesDuration
          console.log(`[Shopping] ? ï¸ TTS ê¸¸ì´: ${totalTtsDuration}ì´?(scriptLines ê¸°ë°˜, ?¤ë””??ë©”í??°ì´???†ìŒ)`)
        } else {
          console.warn(`[Shopping] ? ï¸ scriptLines??endTime??ë¹„ì •?ì ?…ë‹ˆ??(${scriptLinesDuration}ì´?. ê¸°ë³¸ê°??¬ìš©.`)
        }
      }
      
      // ê°??´ë?ì§€???ìƒ ê¸¸ì´ ê³„ì‚° (TTS ê¸¸ì´ë¥?3?¼ë¡œ ?˜ëˆ„ê³?ë°˜ì˜¬ë¦?
      // CRITICAL: ê°??ìƒ?€ ë°˜ë“œ??TTS ê¸¸ì´ / 3?¼ë¡œ ê³ ì •?˜ì–´????      const durationPerVideo = Math.round(totalTtsDuration / 3)
      
      // durationPerVideoê°€ ? íš¨?œì? ?•ì¸ (0ë³´ë‹¤ ì»¤ì•¼ ??
      if (!durationPerVideo || durationPerVideo <= 0) {
        throw new Error(`?ìƒ ê¸¸ì´ ê³„ì‚° ?¤ë¥˜: durationPerVideo=${durationPerVideo}ì´?(TTS: ${totalTtsDuration}ì´?`)
      }
      
      console.log(`[Shopping] ?“Š TTS ê¸¸ì´ ê³„ì‚° ê²°ê³¼:`)
      console.log(`  - TTS ?„ì²´ ê¸¸ì´: ${totalTtsDuration}ì´?)
      console.log(`  - ê°??´ë?ì§€??duration: ${totalTtsDuration} / 3 = ${(totalTtsDuration / 3).toFixed(2)}ì´?)
      console.log(`  - ë°˜ì˜¬ë¦¼ëœ duration: ${durationPerVideo}ì´?)
      console.log(`  - ì´??ìƒ ê¸¸ì´ (?ˆìƒ): ${durationPerVideo * 3}ì´?)
      console.log(`  - ? ï¸ CRITICAL: ê°??ìƒ?€ ë°˜ë“œ??${durationPerVideo}ì´ˆë¡œ ?ì„±?˜ì–´???©ë‹ˆ?? TTS ?„ì²´ ê¸¸ì´(${totalTtsDuration}ì´?ê°€ ?„ë‹™?ˆë‹¤!`)
      
      // ê°??ìƒ??sample_shift ê³„ì‚° (ê°??ìƒ ê¸¸ì´??ë§ê²Œ)
      const sampleShiftPerVideo = Math.max(8, Math.min(16, durationPerVideo))
      
      console.log(`[Shopping] 3ê°??´ë?ì§€ë¥??ìƒ?¼ë¡œ ë³€???œì‘ (TTS: ${totalTtsDuration}ì´? ê°??ìƒ: ${durationPerVideo}ì´? sample_shift: ${sampleShiftPerVideo})`)
      
      const videoResults: Array<{ index: number; videoUrl: string; duration: number; sceneType: string }> = []
      const newVideoMap = new Map<number, string>()
      const sceneNames = ["?œí’ˆ ?¬ìš© ?ìƒ", "?”í…Œ???ìƒ", "?¤ë¥¸ ë°°ê²½ ?ìƒ"]
      
      // ê¸°ì¡´???ì„±???ìƒ???ˆìœ¼ë©?? ì?
      const existingVideos = new Map(convertedVideoUrls)
      
      // 1?¨ê³„: ëª¨ë“  ?´ë?ì§€???€???„ë¡¬?„íŠ¸ë¥?ë¨¼ì? ?ì„± (OpenAI API ?œìš©)
      console.log(`[Shopping] ?“ 1?¨ê³„: ?ìƒ ?„ë¡¬?„íŠ¸ ?ì„± ?œì‘ (OpenAI API ?œìš©)`)
      const videoPromptsMap = new Map<number, string>()
      
      for (let i = 0; i < 3; i++) {
        // ?´ë? ?ì„±???ìƒ???ˆìœ¼ë©??„ë¡¬?„íŠ¸??ê±´ë„ˆ?°ê¸° (ê¸°ì¡´ ?„ë¡¬?„íŠ¸ê°€ ?ˆìœ¼ë©??¬ìš©)
        if (existingVideos.has(i) && videoPrompts.has(i)) {
          console.log(`[Shopping] ??¸ ${sceneNames[i]} ?„ë¡¬?„íŠ¸ ?´ë? ì¡´ì¬, ê±´ë„ˆ?€`)
          videoPromptsMap.set(i, videoPrompts.get(i)!)
          continue
        }
        
        // ?„ë¡¬?„íŠ¸ ?ì„± ì¤??íƒœ ?…ë°?´íŠ¸
        setIsGeneratingVideoPrompts((prev) => {
          const newMap = new Map(prev)
          newMap.set(i, true)
          return newMap
        })
        
        try {
          console.log(`[Shopping] ?¤– ${sceneNames[i]} ?„ë¡¬?„íŠ¸ ?ì„± ì¤?.. (${i + 1}/3)`)
          
          // OpenAI APIë¥??œìš©?˜ì—¬ ?œí’ˆ ?‰ë™ ?„ë¡¬?„íŠ¸ ?ì„±
          const videoPrompt = await generateVideoPromptForImage(
            i as 0 | 1 | 2,
            productName,
            productDescription,
            durationPerVideo,
            openaiApiKey,
            animalCharacter
          )
          
          console.log(`[Shopping] ??${sceneNames[i]} ?„ë¡¬?„íŠ¸ ?ì„± ?„ë£Œ`)
          console.log(`[Shopping] ?“„ ?„ë¡¬?„íŠ¸ ?´ìš© (${sceneNames[i]}):`, videoPrompt.substring(0, 200) + "...")
          
          // ?„ë¡¬?„íŠ¸ ?€??          videoPromptsMap.set(i, videoPrompt)
          setVideoPrompts((prev) => {
            const newMap = new Map(prev)
            newMap.set(i, videoPrompt)
            return newMap
          })
        } catch (error) {
          console.error(`[Shopping] ??${sceneNames[i]} ?„ë¡¬?„íŠ¸ ?ì„± ?¤íŒ¨:`, error)
          setError(`${sceneNames[i]} ?„ë¡¬?„íŠ¸ ?ì„±???¤íŒ¨?ˆìŠµ?ˆë‹¤: ${error instanceof Error ? error.message : "?????†ëŠ” ?¤ë¥˜"}`)
          throw error
        } finally {
          setIsGeneratingVideoPrompts((prev) => {
            const newMap = new Map(prev)
            newMap.set(i, false)
            return newMap
          })
        }
      }
      
      console.log(`[Shopping] ??ëª¨ë“  ?„ë¡¬?„íŠ¸ ?ì„± ?„ë£Œ! ?´ì œ ?ìƒ???ì„±?©ë‹ˆ??`)
      
      // 2?¨ê³„: ?ì„±???„ë¡¬?„íŠ¸ë¥??¬ìš©?˜ì—¬ ?ìƒ ?ì„±
      console.log(`[Shopping] ?¬ 2?¨ê³„: ?ìƒ ?ì„± ?œì‘`)
      
      for (let i = 0; i < 3; i++) {
        // ?´ë? ?ì„±???ìƒ???ˆìœ¼ë©?ê±´ë„ˆ?°ê¸°
        if (existingVideos.has(i)) {
          console.log(`[Shopping] ??¸ ${sceneNames[i]} ?´ë? ?ì„±?? ê±´ë„ˆ?€`)
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
          console.error(`[Shopping] ??${sceneNames[i]} ?„ë¡¬?„íŠ¸ê°€ ?†ìŠµ?ˆë‹¤.`)
          throw new Error(`${sceneNames[i]} ?„ë¡¬?„íŠ¸ê°€ ?ì„±?˜ì? ?Šì•˜?µë‹ˆ??`)
        }
        
        // ë³€???œì‘ ?íƒœ ?…ë°?´íŠ¸
        setIsConvertingToVideo((prev) => {
          const newMap = new Map(prev)
          newMap.set(i, true)
          console.log(`[Shopping] ?”„ ${sceneNames[i]} ë³€???íƒœ ?…ë°?´íŠ¸: true (?¸ë±??${i})`)
          return newMap
        })
        
        console.log(`[Shopping] ?“¹ ${sceneNames[i]} ?ìƒ ?ì„± ?œì‘ (${i + 1}/3)`)
        console.log(`[Shopping] ? ï¸ CRITICAL: ê°??ìƒ ê¸¸ì´ = ${durationPerVideo}ì´?(TTS ?„ì²´: ${totalTtsDuration}ì´?/ 3 = ${(totalTtsDuration / 3).toFixed(2)}ì´?`)
        console.log(`[Shopping] ? ï¸ CRITICAL: ???ìƒ?€ ë°˜ë“œ??${durationPerVideo}ì´ˆë¡œ ?ì„±?˜ì–´???©ë‹ˆ?? TTS ?„ì²´ ê¸¸ì´(${totalTtsDuration}ì´?ê°€ ?„ë‹™?ˆë‹¤!`)
        console.log(`[Shopping] ?“„ ?¬ìš©???„ë¡¬?„íŠ¸:`, videoPrompt.substring(0, 200) + "...")
        
        // ?´ë?ì§€ë¥??ìƒ?¼ë¡œ ë³€??(bytedance/seedance-1-pro-fast ëª¨ë¸ ?¬ìš©, duration ?¬ìš©)
        // CRITICAL: durationPerVideo??ë°˜ë“œ??TTS/3?¼ë¡œ ê³„ì‚°??ê°’ì´?´ì•¼ ??        if (durationPerVideo !== Math.round(totalTtsDuration / 3)) {
          console.error(`[Shopping] ??CRITICAL ERROR: durationPerVideoê°€ ?¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤!`)
          console.error(`  - durationPerVideo: ${durationPerVideo}ì´?)
          console.error(`  - ?ˆìƒ ê°?(TTS/3): ${Math.round(totalTtsDuration / 3)}ì´?)
          console.error(`  - TTS ?„ì²´: ${totalTtsDuration}ì´?)
          throw new Error(`?ìƒ ê¸¸ì´ ê³„ì‚° ?¤ë¥˜: durationPerVideo=${durationPerVideo}ì´? ?ˆìƒ=${Math.round(totalTtsDuration / 3)}ì´?)
        }
        
        try {
          const videoUrl = await generateVideoWithSeedance(
            imageUrl,
            videoPrompt,
            durationPerVideo, // duration ?„ë‹¬ (ë°˜ë“œ??TTS/3)
            replicateApiKey
          )
          
          console.log(`[Shopping] ??${sceneNames[i]} ?ì„± ?„ë£Œ:`, videoUrl)
          
          // ë³€?˜ëœ ?ìƒ URL ?€??ë°?ì¦‰ì‹œ ?œì‹œ
          newVideoMap.set(i, videoUrl)
          setConvertedVideoUrls(new Map(newVideoMap))
          
          videoResults.push({
            index: i,
            videoUrl,
            duration: durationPerVideo, // ê³„ì‚°??duration ?¬ìš©
            sceneType: sceneNames[i]
          })
        } catch (error) {
          console.error(`[Shopping] ??${sceneNames[i]} ?ì„± ?¤íŒ¨:`, error)
          throw error
        } finally {
          // ?íƒœ ?…ë°?´íŠ¸??finally?ì„œ ?•ì‹¤???˜í–‰
          setIsConvertingToVideo((prev) => {
            const newMap = new Map(prev)
            newMap.set(i, false)
            // ëª¨ë“  ?ìƒ???„ë£Œ?˜ì—ˆ?”ì? ?•ì¸
            const allComplete = Array.from(newMap.values()).every(v => v === false)
            console.log(`[Shopping] ?”„ ${sceneNames[i]} ë³€???íƒœ ?…ë°?´íŠ¸: false (?¸ë±??${i}), ëª¨ë“  ?ìƒ ?„ë£Œ: ${allComplete}, ?„ì¬ ?íƒœ:`, Array.from(newMap.entries()))
            return newMap
          })
        }
      }
      
      // ?ìƒ ?©ì¹˜ê¸?ê¸°ëŠ¥ ?œê±° - ê°œë³„ ?ìƒ 3ê°œë§Œ ?¬ìš©
      const totalVideoDuration = videoResults.reduce((sum, result) => sum + result.duration, 0)
      console.log(`[Shopping] 3ê°??ìƒ ë³€???„ë£Œ (ê°??ìƒ: ${durationPerVideo}ì´? ì´?${totalVideoDuration.toFixed(1)}ì´? TTS: ${totalTtsDuration}ì´?`)
      
      // ëª¨ë“  ?ìƒ???€?¥ë˜?ˆëŠ”ì§€ ?•ì¸?˜ê³  ìµœì¢… ?…ë°?´íŠ¸
      if (newVideoMap.size === 3) {
        console.log(`[Shopping] ??ëª¨ë“  ?ìƒ???±ê³µ?ìœ¼ë¡??€?¥ë˜?ˆìŠµ?ˆë‹¤ (${newVideoMap.size}/3)`)
        // ìµœì¢… ?íƒœ ?…ë°?´íŠ¸ (ëª¨ë“  ?ìƒ???•ì‹¤???€?¥ë˜?„ë¡)
        setConvertedVideoUrls(new Map(newVideoMap))
      } else {
        console.warn(`[Shopping] ? ï¸ ?ìƒ ?€???íƒœ ?•ì¸: ${newVideoMap.size}/3`)
      }
      
      // ëª¨ë“  ë³€???íƒœ ?•ì‹¤??ì´ˆê¸°??(ëª¨ë“  ?ìƒ ?„ë£Œ ??
      // ?íƒœ ?…ë°?´íŠ¸ê°€ ?„ë£Œ???œê°„??ì£¼ê³  ?•ì‹¤??ì´ˆê¸°??      await new Promise(resolve => setTimeout(resolve, 200)) // ?íƒœ ?…ë°?´íŠ¸ê°€ ?„ë£Œ???œê°„??ì¤?      setIsConvertingToVideo((prev) => {
        // ëª¨ë“  ê°’ì´ false?¸ì? ?•ì¸?˜ê³  ë¹?Map?¼ë¡œ ì´ˆê¸°??        const allFalse = Array.from(prev.values()).every(v => v === false)
        if (allFalse || prev.size === 0) {
          console.log(`[Shopping] ?”„ ëª¨ë“  ë³€???íƒœ ì´ˆê¸°???„ë£Œ (?´ì „ ?íƒœ: ${prev.size}ê°???ª©)`)
          return new Map()
        }
        // ?¹ì‹œ ëª¨ë? ê²½ìš°ë¥??„í•´ ëª¨ë“  ??ª©??falseë¡??¤ì •
        const clearedMap = new Map<number, boolean>()
        console.log(`[Shopping] ?”„ ëª¨ë“  ë³€???íƒœë¥?falseë¡??¤ì • ??ì´ˆê¸°??)
        return clearedMap
      })
    } catch (error) {
      console.error("[Shopping] ???ìƒ ë³€???¤íŒ¨:", error)
      setError(`?ìƒ ë³€?˜ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤: ${error instanceof Error ? error.message : "?????†ëŠ” ?¤ë¥˜"}`)
      
      // ?ëŸ¬ ë°œìƒ ??ëª¨ë“  ë³€???íƒœ ì´ˆê¸°??      setIsConvertingToVideo(new Map())
      setIsMergingVideos(false)
      console.log(`[Shopping] ?”„ ?ëŸ¬ ë°œìƒ?¼ë¡œ ?¸í•œ ëª¨ë“  ?íƒœ ì´ˆê¸°???„ë£Œ`)
    }
  }

  // ê°œë³„ ?ìƒ ?¬ìƒ??  const handleRegenerateSingleVideo = async (index: 0 | 1 | 2) => {
    if (imageUrls.length <= index) {
      alert("?´ë‹¹ ?´ë?ì§€ê°€ ?†ìŠµ?ˆë‹¤.")
      return
    }

    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined
    const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined

    if (!replicateApiKey) {
      alert("Replicate API ?¤ê? ?„ìš”?©ë‹ˆ?? ë©”ì¸ ?”ë©´???¤ì •(?±ë‹ˆë°”í€??„ì´ì½??ì„œ API ?¤ë? ?…ë ¥?´ì£¼?¸ìš”.")
      return
    }

    // ì¦‰ì‹œ ë¡œë”© ?íƒœ ?œì‹œ
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
    
    // ?¥ë©´ ?´ë¦„ ?•ì˜ (try-catch ë¸”ë¡?ì„œ ëª¨ë‘ ?¬ìš© ê°€?¥í•˜?„ë¡ ?¨ìˆ˜ ?ë‹¨???•ì˜)
    const sceneNames = ["?œí’ˆ ?¬ìš© ?ìƒ", "?”í…Œ???ìƒ", "?¤ë¥¸ ë°°ê²½ ?ìƒ"]
    
    try {
      // TTS ê¸¸ì´ ê³„ì‚°
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
          console.warn("[Shopping] TTS ?¤ë””??ê¸¸ì´ ê°€?¸ì˜¤ê¸??¤íŒ¨:", audioError)
        }
      }
      
      // ê°??´ë?ì§€???ìƒ ê¸¸ì´ ê³„ì‚°
      // CRITICAL: ê°??ìƒ?€ ë°˜ë“œ??TTS ê¸¸ì´ / 3?¼ë¡œ ê³ ì •?˜ì–´????      const durationPerVideo = Math.round(totalTtsDuration / 3)
      
      // durationPerVideoê°€ ? íš¨?œì? ?•ì¸ (0ë³´ë‹¤ ì»¤ì•¼ ??
      if (!durationPerVideo || durationPerVideo <= 0) {
        throw new Error(`?ìƒ ê¸¸ì´ ê³„ì‚° ?¤ë¥˜: durationPerVideo=${durationPerVideo}ì´?(TTS: ${totalTtsDuration}ì´?`)
      }
      
      console.log(`[Shopping] ? ï¸ CRITICAL: ê°??ìƒ?€ ë°˜ë“œ??${durationPerVideo}ì´ˆë¡œ ?ì„±?˜ì–´???©ë‹ˆ?? TTS ?„ì²´ ê¸¸ì´(${totalTtsDuration}ì´?ê°€ ?„ë‹™?ˆë‹¤!`)
      
      // 1?¨ê³„: ?„ë¡¬?„íŠ¸ ë¨¼ì? ?ì„± (OpenAI API ?œìš©)
      console.log(`[Shopping] ?“ 1?¨ê³„: ${sceneNames[index]} ?„ë¡¬?„íŠ¸ ?ì„± ?œì‘ (OpenAI API ?œìš©)`)
      
      let videoPrompt: string
      try {
        console.log(`[Shopping] ?¤– ${sceneNames[index]} ?„ë¡¬?„íŠ¸ ?ì„± ì¤?..`)
      
        // OpenAI APIë¥??œìš©?˜ì—¬ ?œí’ˆ ?‰ë™ ?„ë¡¬?„íŠ¸ ?ì„±
        videoPrompt = await generateVideoPromptForImage(
        index,
        productName,
        productDescription,
        durationPerVideo,
        openaiApiKey,
        animalCharacter
      )
        
        console.log(`[Shopping] ??${sceneNames[index]} ?„ë¡¬?„íŠ¸ ?ì„± ?„ë£Œ`)
        console.log(`[Shopping] ?“„ ?„ë¡¬?„íŠ¸ ?´ìš©:`, videoPrompt.substring(0, 200) + "...")
        
        // ?„ë¡¬?„íŠ¸ ?€??        setVideoPrompts((prev) => {
          const newMap = new Map(prev)
          newMap.set(index, videoPrompt)
          return newMap
        })
      } catch (error) {
        console.error(`[Shopping] ??${sceneNames[index]} ?„ë¡¬?„íŠ¸ ?ì„± ?¤íŒ¨:`, error)
        setError(`${sceneNames[index]} ?„ë¡¬?„íŠ¸ ?ì„±???¤íŒ¨?ˆìŠµ?ˆë‹¤: ${error instanceof Error ? error.message : "?????†ëŠ” ?¤ë¥˜"}`)
        throw error
      } finally {
        setIsGeneratingVideoPrompts((prev) => {
          const newMap = new Map(prev)
          newMap.set(index, false)
          return newMap
        })
      }
      
      // 2?¨ê³„: ?ì„±???„ë¡¬?„íŠ¸ë¥??¬ìš©?˜ì—¬ ?ìƒ ?ì„±
      console.log(`[Shopping] ?¬ 2?¨ê³„: ${sceneNames[index]} ?ìƒ ?ì„± ?œì‘`)
      
      // ?„ë¡¬?„íŠ¸ ?ì„± ?„ë£Œ, ?´ì œ ?ìƒ ?ì„± ?¨ê³„
      setIsGeneratingVideoPrompts((prev) => {
        const newMap = new Map(prev)
        newMap.set(index, false)
        return newMap
      })
      
      console.log(`[Shopping] ?“¹ ${sceneNames[index]} ?¬ìƒ???œì‘ (ê¸¸ì´: ${durationPerVideo}ì´?`)
      console.log(`[Shopping] ?“„ ?¬ìš©???„ë¡¬?„íŠ¸:`, videoPrompt.substring(0, 200) + "...")
      
      // ?´ë?ì§€ë¥??ìƒ?¼ë¡œ ë³€??      const imageUrl = imageUrls[index]
      const videoUrl = await generateVideoWithSeedance(
        imageUrl,
        videoPrompt,
        durationPerVideo,
        replicateApiKey
      )
      
      console.log(`[Shopping] ??${sceneNames[index]} ?¬ìƒ???„ë£Œ:`, videoUrl)
      
      // ë³€?˜ëœ ?ìƒ URL ?€??ë°?ì¦‰ì‹œ ?œì‹œ
      setConvertedVideoUrls((prev) => {
        const newMap = new Map(prev)
        newMap.set(index, videoUrl)
        return newMap
      })
      
    } catch (error) {
      console.error(`[Shopping] ??${sceneNames[index]} ?¬ìƒ???¤íŒ¨:`, error)
      setError(`?ìƒ ?¬ìƒ?±ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤: ${error instanceof Error ? error.message : "?????†ëŠ” ?¤ë¥˜"}`)
    } finally {
      // ?íƒœ ?…ë°?´íŠ¸
      setIsConvertingToVideo((prev) => {
        const newMap = new Map(prev)
        newMap.set(index, false)
        return newMap
      })
    }
  }

  // ê°œë³„ ?¥ë©´???ìƒ?¼ë¡œ ë³€??(?ˆê±°??- ?¸í™˜??? ì?)
  const handleConvertImageToVideo = async (sceneIndex: number) => {
    if (imageUrls.length === 0) {
      alert("?´ë?ì§€ê°€ ì¤€ë¹„ë˜?´ì•¼ ?©ë‹ˆ??")
      return
    }

    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined

    if (!replicateApiKey) {
      alert("Replicate API ?¤ê? ?„ìš”?©ë‹ˆ?? ë©”ì¸ ?”ë©´???¤ì •(?±ë‹ˆë°”í€??„ì´ì½??ì„œ API ?¤ë? ?…ë ¥?´ì£¼?¸ìš”.")
      return
    }

    // ?´ë‹¹ ?¥ë©´??ë³€???íƒœë¥?trueë¡??¤ì •
    setIsConvertingToVideo((prev) => {
      const newMap = new Map(prev)
      newMap.set(sceneIndex, true)
      return newMap
    })
    setError("")
    try {
      console.log(`[Shopping] ?¥ë©´ ${sceneIndex + 1} ?ìƒ ë³€???œì‘`)

      // ?€ë³¸ì´ ?ˆìœ¼ë©??´ë‹¹ ?¥ë©´???€ë³??¬ìš©, ?†ìœ¼ë©?ê¸°ë³¸ ?„ë¡¬?„íŠ¸
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
      
      // ë³€?˜ëœ ?ìƒ URL ?€??      setConvertedVideoUrls((prev) => {
        const newMap = new Map(prev)
        newMap.set(sceneIndex, videoUrl)
        return newMap
      })
      
      console.log(`[Shopping] ?¥ë©´ ${sceneIndex + 1} ?ìƒ ë³€???„ë£Œ:`, videoUrl)
      alert(`?¥ë©´ ${sceneIndex + 1} ?ìƒ ë³€?˜ì´ ?„ë£Œ?˜ì—ˆ?µë‹ˆ??`)
    } catch (error) {
      console.error(`[Shopping] ?¥ë©´ ${sceneIndex + 1} ?ìƒ ë³€???¤íŒ¨:`, error)
      setError(`?¥ë©´ ${sceneIndex + 1} ?ìƒ ë³€?˜ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤: ${error instanceof Error ? error.message : "?????†ëŠ” ?¤ë¥˜"}`)
    } finally {
      // ?´ë‹¹ ?¥ë©´??ë³€???íƒœë¥?falseë¡??¤ì •
      setIsConvertingToVideo((prev) => {
        const newMap = new Map(prev)
        newMap.set(sceneIndex, false)
        return newMap
      })
    }
  }

  // ëª¨ë°”??ê¸°ê¸° ê°ì?
  const isMobile = () => {
    if (typeof window === "undefined") return false
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           (window.innerWidth <= 768)
  }

  // ë¹„ë””???¤ìš´ë¡œë“œ (ëª¨ë°”???€??
  // ?ˆì•½ ë°œí–‰ ëª¨ë‹¬ ?´ê¸° (ê¸°ë³¸ê°? ?´ì¼ 09:00)
  const handleOpenScheduleModal = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setScheduleDate(tomorrow.toISOString().slice(0, 10))
    setScheduleTime("09:00")
    setScheduleModalOpen(true)
  }

  // ?ˆì•½ ë°œí–‰ ?•ì •: ?ìƒ ?Œë” ??blob ?€????ëª©ë¡??ì¶”ê?
  const handleConfirmSchedule = async () => {
    if (!scheduleDate || !scheduleTime) {
      alert("ë°œí–‰ ? ì§œ?€ ?œê°„??? íƒ?´ì£¼?¸ìš”.")
      return
    }
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`)
    if (scheduledAt <= new Date()) {
      alert("ë°œí–‰ ?¼ì‹œ???„ì¬ë³´ë‹¤ ë¯¸ë˜ë¡??¤ì •?´ì£¼?¸ìš”.")
      return
    }
    const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const newItem: ShoppingScheduleItem = {
      id: scheduleId,
      productName: productName || "?œí’ˆ",
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
          alert("?ˆì•½ ë°œí–‰???±ë¡?˜ì—ˆ?µë‹ˆ?? ?´ë‹¹ ? ì§œ???ˆì•½ ëª©ë¡?ì„œ ?¤ìš´ë¡œë“œ?????ˆìŠµ?ˆë‹¤.")
        },
      })
    } catch (e) {
      setIsScheduling(false)
      setScheduleModalOpen(false)
      alert("?ˆì•½ ë°œí–‰ ì²˜ë¦¬ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.")
    }
  }

  // ?ˆì•½ ëª©ë¡?ì„œ ?ìƒ ?¤ìš´ë¡œë“œ (ëª¨ë°”?? ê³µìœ /??ì°?
  const handleDownloadScheduled = async (item: ShoppingScheduleItem) => {
    const blob = await getShotFormScheduleVideoBlob(item.id)
    if (!blob) {
      alert("?€?¥ëœ ?ìƒ??ì°¾ì„ ???†ìŠµ?ˆë‹¤.")
      return
    }
    const fileName = `${item.productName}_?ˆì•½_${item.id.slice(0, 12)}.webm`
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

  // ?ˆì•½ ??ª© ?? œ
  const handleRemoveScheduled = (item: ShoppingScheduleItem) => {
    if (!confirm(`"${item.productName}" ?ˆì•½???? œ? ê¹Œ??`)) return
    deleteShotFormScheduleVideoBlob(item.id).catch(() => {})
    persistScheduledItems(scheduledItems.filter((s) => s.id !== item.id))
  }

  const factoryPipelineScriptStartedRef = useRef(false)
  const factoryServerDownloadTriggeredRef = useRef<string | null>(null)
  const factoryPreviewAutoTriggeredRef = useRef<string | null>(null)

  // ?ë™??ëª¨ë“œ: ?´ë‹¹ ? ì§œ ?„ë˜ ???˜ë™?¼ë¡œ ?ìƒ ?ì„± ?œì‘ (?œì‘ ?”ë©´?¼ë¡œ ?´ë™)
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

  // ?ë™??ëª¨ë“œ: ?í’ˆ ?´ë¦­ ???˜ë™ ëª¨ë“œë¡?ì§„ì… (?„ë¡œ?íŠ¸ ?ˆìœ¼ë©?ë¶ˆëŸ¬?¤ê¸°, ?†ìœ¼ë©??œí’ˆ ?•ë³´ë§?ë¡œë“œ). ?¸ë„¤?¼ì? AI ?ì„±?¼ë¡œ ?¤ì •.
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
        console.warn("[Factory] ?„ë¡œ?íŠ¸ ë¶ˆëŸ¬?¤ê¸° ?¤íŒ¨, ?œí’ˆ ?•ë³´ë§?ë¡œë“œ:", err)
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

  // ?ë™??ëª¨ë“œ: ë°±ê·¸?¼ìš´?œì—???„ì²´ ?Œì´?„ë¼???¤í–‰ (?”ë©´ ?„í™˜ ?†ì´ ?ë™??ëª¨ë“œ??ë¨¸ë¬¼ë©?ì§„í–‰ ?í™©ë§??œì‹œ)
  // ê°??¨ê³„ ?„ë£Œ ???ë™?¼ë¡œ ?„ë¡œ?íŠ¸ ?ì„±Â·?€??  const runFactoryPipelineInBackground = async (item: FactoryScheduleItem) => {
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
        console.warn("[Factory] ?„ë¡œ?íŠ¸ ?¨ê³„ ?€???¤íŒ¨:", e)
      }
    }

    try {
      const openaiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined
      const replicateKey = typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined
      if (!openaiKey) {
        updatePhase("product", "failed", "OpenAI API ?¤ê? ?†ìŠµ?ˆë‹¤.")
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
        updatePhase("script", "failed", "?€ë³?ë¶„í•  ?¤íŒ¨")
        return
      }

      // ?€ë³??„ë£Œ ?? ?„ë¡œ?íŠ¸ ?ë™ ?ì„± ë°?1?¨ê³„ ?€??      if (userId) {
        try {
          if (!projectId) {
            const projectName = `${item.productName} (?ˆì•½ ${item.scheduledDate} ${item.scheduledTime || "00:00"})`
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
          console.warn("[Factory] ?„ë¡œ?íŠ¸ ?ì„±/?€???¤íŒ¨:", e)
        }
      }

      updatePhase("video")
      if (!replicateKey) {
        updatePhase("video", "failed", "Replicate API ?¤ê? ?†ìŠµ?ˆë‹¤.")
        return
      }
      // ë©”ì¸ ?Œë¡œ?°ì? ?™ì¼?˜ê²Œ ?´ë?ì§€???„ë¡¬?„íŠ¸ë¥?ë¨¼ì? ?ì„± (?€ë³??ìŠ¤?¸ë? ê·¸ë?ë¡??°ë©´ nano-bananaê°€ ?¤íŒ¨??
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
        console.warn("[Factory] ?´ë?ì§€ ?„ë¡¬?„íŠ¸ ?ì„± ?¤íŒ¨, ?¥ë©´ ?ìŠ¤?¸ë¡œ ?€ì²?", promptErr)
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
          updatePhase("tts", "failed", "?˜í¼??API ?¤ê? ?†ìŠµ?ˆë‹¤.")
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
          updatePhase("tts", "failed", "?€?…ìº?¤íŠ¸ API ?¤ê? ?†ìŠµ?ˆë‹¤.")
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
          updatePhase("tts", "failed", "ElevenLabs API ?¤ê? ?†ìŠµ?ˆë‹¤.")
          return
        }
        ttsResponse = await fetch("/api/elevenlabs-tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: ttsText, voiceId: eid, apiKey: elevenKey, speed: factorySpeed }),
        })
      } else if (voiceId.startsWith("ttsmaker-")) {
        updatePhase("tts", "failed", "TTSMaker?????´ìƒ ì§€?í•˜ì§€ ?ŠìŠµ?ˆë‹¤. ElevenLabs ?±ìœ¼ë¡?ë°”ê¿”ì£¼ì„¸??")
        return
      } else {
        updatePhase("tts", "failed", "ì§€?í•˜ì§€ ?ŠëŠ” ëª©ì†Œë¦¬ì…?ˆë‹¤.")
        return
      }
      if (!ttsResponse.ok) {
        const err = await ttsResponse.json().catch(() => ({}))
        updatePhase("tts", "failed", err.error || "TTS ?ì„± ?¤íŒ¨")
        return
      }
      const ttsData = await ttsResponse.json()
      if (!ttsData.audioBase64 && !ttsData.audioUrl) {
        updatePhase("tts", "failed", ttsData.error || "TTS ?¤ë””???†ìŒ")
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
          console.warn("[Factory] TTS ?…ë¡œ???€???¤íŒ¨:", e)
        }
      }
      const totalChars = script.length
      const scriptLines: ScriptLine[] = []
      let currentTime = 0
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i]
        const sentences = scene.split(/[.!??‚ï¼ï¼?\s*/).filter((s) => s.trim().length > 0)
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
        console.warn("[Factory] AI ?¸ë„¤???ì„± ?¤íŒ¨, ?í’ˆ ?´ë?ì§€ë¡?ì§„í–‰:", thumbErr)
        thumbUrl = item.productImageBase64?.startsWith("data:")
          ? item.productImageBase64
          : item.productImageBase64
            ? `data:image/jpeg;base64,${item.productImageBase64}`
            : ""
      }
      if (!thumbUrl) {
        throw new Error("?¸ë„¤?¼ì„ ?ì„±?????†ê³  ?í’ˆ ?´ë?ì§€???†ìŠµ?ˆë‹¤.")
      }

      updatePhase("preview")
      await saveProjectStep({ activeStep: "preview" })

      // ?¸ë„¤???„ë£Œ ??ê³§ë°”ë¡??œë²„ ?Œë”ë§??˜í–‰ ??PC ?¤ìš´ë¡œë“œ ??? íŠœë¸??…ë¡œ??(?´ë¼?´ì–¸??ë¯¸ë¦¬ë³´ê¸° ?ëµ)
      const durationSec = actualAudioDuration
      const getBlobFromUrl = async (url: string): Promise<Blob> => {
        if (url.startsWith("data:")) {
          const res = await fetch(url)
          return res.blob()
        }
        const res = await fetch(url)
        if (!res.ok) throw new Error(`?¤ìš´ë¡œë“œ ?¤íŒ¨: ${url}`)
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
        throw new Error(errData.error || `?Œë” ?”ì²­ ?¤íŒ¨: ${renderRes.status}`)
      }
      const result = await renderRes.json()
      const videoUrl = result.videoUrl
      const videoBase64 = result.videoBase64
      let serverBlob: Blob
      if (videoUrl) {
        const videoRes = await fetch(videoUrl)
        if (!videoRes.ok) throw new Error("?Œë”???ìƒ ?¤ìš´ë¡œë“œ ?¤íŒ¨")
        serverBlob = await videoRes.blob()
      } else if (videoBase64) {
        const binary = atob(videoBase64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        serverBlob = new Blob([bytes], { type: "video/mp4" })
      } else {
        throw new Error("?‘ë‹µ??videoUrl ?ëŠ” videoBase64ê°€ ?†ìŠµ?ˆë‹¤.")
      }
      await saveShotFormScheduleVideoBlob(item.id, serverBlob)

      // ê¸°ê¸°ë¡??Œì¼ ?€??(ëª¨ë°”?? ê³µìœ /??ì°? PC: ?¤ìš´ë¡œë“œ)
      const factoryFileName = `${item.productName}_ê³µì¥_${item.id.slice(0, 8)}.mp4`
      const downloadUrl = URL.createObjectURL(serverBlob)
      const isMobileDevice = typeof navigator !== "undefined" && (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (typeof window !== "undefined" && window.innerWidth <= 768))
      if (isMobileDevice) {
        const file = new File([serverBlob], factoryFileName, { type: "video/mp4" })
        if (typeof navigator !== "undefined" && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: factoryFileName, text: "?Œë”ë§ëœ ?ìƒ" })
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

      // ? íŠœë¸??…ë¡œ?œìš© ?œëª©Â·?¤ëª…Â·?œê·¸ ?ì„± (ë°±ê·¸?¼ìš´?œì—?œëŠ” ??ƒ ?¬ê¸°???ì„±)
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
        console.warn("[Factory] ? íŠœë¸?ë©”í??°ì´???ì„± ?¤íŒ¨, ?œí’ˆëª…ë§Œ ?¬ìš©:", metaErr)
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
      console.error("[Factory] ë°±ê·¸?¼ìš´???Œì´?„ë¼???¤íŒ¨:", e)
      setFactorySchedules((prev) => {
        const next = prev.map((s) =>
          s.id === item.id ? { ...s, status: "failed" as const, errorMessage: e instanceof Error ? e.message : String(e) } : s
        )
        localStorage.setItem(FACTORY_SCHEDULES_STORAGE_KEY, JSON.stringify(next))
        return next
      })
    }
  }

  // ?ë™??ëª¨ë“œ ?? ??ë²ˆì— ?˜ë‚˜?©ë§Œ ë°±ê·¸?¼ìš´???Œì´?„ë¼???¤í–‰ (?œì°¨ ì²˜ë¦¬)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queueë§?ë°˜ì‘, pipeline ?¨ìˆ˜??ìµœì‹  ?´ë¡œ?€ ?¬ìš©
  }, [factoryPipelineQueue])

  useEffect(() => {
    if (!factoryAutoRunItem || factoryPipelineScriptStartedRef.current || activeStep !== "product") return
    if (!productName) return
    factoryPipelineScriptStartedRef.current = true
    handleGenerateScript()
  }, [factoryAutoRunItem, activeStep, productName])

  // ?ë™??ëª¨ë“œ: ?¸ë„¤??ì¤€ë¹„ë˜ë©??ë™?¼ë¡œ ë¯¸ë¦¬ë³´ê¸° ?¨ê³„ë¡??´ë™ (ë²„íŠ¼ ?´ë¦­ ?†ì´)
  useEffect(() => {
    if (!factoryAutoRunItem || activeStep !== "thumbnail") return
    const thumbReady = thumbnailUrl || thumbnailImages.length > 0
    if (!thumbReady || convertedVideoUrls.size !== 3 || !ttsAudioUrl) return
    setActiveStep("preview")
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ?ë™ ì§„í–‰??  }, [factoryAutoRunItem?.id, activeStep, thumbnailUrl, thumbnailImages.length, convertedVideoUrls.size, ttsAudioUrl])

  // ?ë™??ëª¨ë“œ: ë¯¸ë¦¬ë³´ê¸° ?¨ê³„ ì§„ì… ??ë¯¸ë¦¬ë³´ê¸° ?ì„± ?ë™ ?¤í–‰ (??ë²ˆë§Œ)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refë¡???ë²ˆë§Œ ?¸ì¶œ
  }, [factoryAutoRunItem?.id, activeStep, previewGenerated, isGeneratingPreview, convertedVideoUrls.size, ttsAudioUrl])

  // ?ë™??ëª¨ë“œ: ë¯¸ë¦¬ë³´ê¸° ?ì„± ?„ë£Œ ???œë²„ ?¤ìš´ë¡œë“œ(?Œë”) ?ë™ ?œì‘ (??ë²ˆë§Œ)
  useEffect(() => {
    if (!factoryAutoRunItem) {
      factoryServerDownloadTriggeredRef.current = null
      return
    }
    if (activeStep !== "preview" || !previewGenerated || isServerDownloading) return
    if (factoryServerDownloadTriggeredRef.current === factoryAutoRunItem.id) return
    factoryServerDownloadTriggeredRef.current = factoryAutoRunItem.id
    handleServerDownload()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref ë°©ì?ë¡???ë²ˆë§Œ ?¸ì¶œ
  }, [factoryAutoRunItem?.id, activeStep, previewGenerated, isServerDownloading])

  const handleDownload = () => {
    if (!videoUrl) return

    const mobile = isMobile()
    
    if (mobile) {
      // ëª¨ë°”?¼ì—?œëŠ” ??ì°½ì—???´ê¸° ?ëŠ” ê³µìœ  ê¸°ëŠ¥ ?¬ìš©
      try {
        // iOS Safari?ì„œ???¤ìš´ë¡œë“œê°€ ?œí•œ?˜ë?ë¡???ì°½ì—???´ê¸°
        const newWindow = window.open(videoUrl, "_blank")
        if (!newWindow) {
          // ?ì—…??ì°¨ë‹¨??ê²½ìš° ?¬ìš©?ì—ê²??Œë¦¼
          alert("ëª¨ë°”?¼ì—?œëŠ” ?ìƒ????ì°½ì—???´ì–´ ?¤ìš´ë¡œë“œ?˜ê±°??ê³µìœ ?????ˆìŠµ?ˆë‹¤.\n\n?ìƒ URL??ë³µì‚¬?˜ì—¬ ?¬ìš©?˜ì„¸??")
          // URL ë³µì‚¬ ê¸°ëŠ¥ ?œê³µ
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(videoUrl).then(() => {
              alert("?ìƒ URL???´ë¦½ë³´ë“œ??ë³µì‚¬?˜ì—ˆ?µë‹ˆ??")
            }).catch(() => {
              // ë³µì‚¬ ?¤íŒ¨ ??URL ?œì‹œ
              prompt("?ìƒ URL (ë³µì‚¬?˜ì„¸??:", videoUrl)
            })
          } else {
            prompt("?ìƒ URL (ë³µì‚¬?˜ì„¸??:", videoUrl)
          }
        }
      } catch (error) {
        console.error("?¤ìš´ë¡œë“œ ?¤íŒ¨:", error)
        alert("ëª¨ë°”?¼ì—?œëŠ” ?ìƒ ?¤ìš´ë¡œë“œê°€ ?œí•œ?????ˆìŠµ?ˆë‹¤.\n\n?ìƒ URL??ë³µì‚¬?˜ì—¬ ?¬ìš©?˜ì„¸??")
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(videoUrl).then(() => {
            alert("?ìƒ URL???´ë¦½ë³´ë“œ??ë³µì‚¬?˜ì—ˆ?µë‹ˆ??")
          }).catch(() => {
            prompt("?ìƒ URL (ë³µì‚¬?˜ì„¸??:", videoUrl)
          })
        } else {
          prompt("?ìƒ URL (ë³µì‚¬?˜ì„¸??:", videoUrl)
        }
      }
    } else {
      // ?°ìŠ¤?¬í†±?ì„œ???¼ë°˜ ?¤ìš´ë¡œë“œ
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
            <Card className="overflow-hidden rounded-2xl border border-[rgba(243,235,224,0.12)] bg-[#121a16]/95 shadow-2xl">
              <CardHeader className="relative z-10 border-b border-[rgba(243,235,224,0.1)] pb-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-[#8fbc8f]/30 bg-[#8fbc8f]/15 p-2 shadow-sm">
                    <PawPrint className="h-5 w-5 text-[#8fbc8f]" />
                  </div>
                  <div>
                    <p className="animal-bubble-chip inline-flex px-2.5 py-1 text-[10px]">?¾ CASTING</p>
                    <CardTitle className="animal-display mt-2 text-xl font-bold text-[#fff6ee]">
                      1. ê·€?¬ìš´ ìºë¦­??ë§Œë“¤ê¸?                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 space-y-5 py-6">
                <p className="text-sm leading-6 text-[#9aa89c]">
                  ë¨¼ì? ?°ë¦¬ ê°€ê²Œì˜ ê·€?¬ìš´ ì¹œêµ¬ë¥?ê³¨ë¼?? ?ˆí¼?°ìŠ¤ë¥?ë§Œë“¤ë©??¥ë©´ë§ˆë‹¤ ?¼êµ´?????‘ê°™???˜ì???
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
                            ? "border-[#ff8fab]/50 bg-[#ff8fab]/15 shadow-lg shadow-[#ff8fab]/20 scale-[1.02]"
                            : "border-[rgba(255,246,238,0.1)] bg-black/25 hover:border-[#7dd3a8]/40 hover:scale-[1.01]"
                        }`}
                      >
                        <div className="relative aspect-square w-full bg-gradient-to-br from-[#7dd3a8]/15 to-[#ff8fab]/10">
                          {preset.sampleImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={preset.sampleImage}
                              alt={`${preset.label} ?˜í”Œ`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[#9aa89c]">
                              <span className="text-3xl">{preset.emoji}</span>
                              <span className="text-[10px] font-medium">ì§ì ‘ ë§Œë“¤ê¸?/span>
                            </div>
                          )}
                          {selected ? (
                            <span className="absolute right-1.5 top-1.5 rounded-full bg-[#ff8fab] px-1.5 py-0.5 text-[9px] font-bold text-white shadow">
                              ? íƒ
                            </span>
                          ) : null}
                        </div>
                        <div className="px-2.5 py-2.5">
                          <p className="flex items-center gap-1 text-sm font-bold text-[#f3ebe0]">
                            <span>{preset.emoji}</span>
                            {preset.label}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-[#9aa89c]">
                            {preset.character.personality}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-[#d7e0d8]">ìºë¦­???´ë¦„</Label>
                    <Input
                      value={animalCharacter.name}
                      onChange={(e) => handleUpdateCharacterField("name", e.target.value)}
                      placeholder="?? ?˜ë¹„"
                      className="h-11 border-[rgba(243,235,224,0.12)] bg-black/35 text-[#f3ebe0]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-[#d7e0d8]">?±ê²© / ??/Label>
                    <Input
                      value={animalCharacter.personality}
                      onChange={(e) => handleUpdateCharacterField("personality", e.target.value)}
                      placeholder="?? ì§„ì????¥ë³´ê¸?ê³ ì–‘??
                      className="h-11 border-[rgba(243,235,224,0.12)] bg-black/35 text-[#f3ebe0]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-[#d7e0d8]">
                    ?¸í˜• ?¤ëª… {animalCharacter.presetId === "custom" ? <span className="text-[#c45c3e]">*</span> : null}
                  </Label>
                  <Input
                    value={animalCharacter.breedOrLook}
                    onChange={(e) => handleUpdateCharacterField("breedOrLook", e.target.value)}
                    placeholder="?? ì£¼í™©??ì¤„ë¬´????¹„ ê³ ì–‘??
                    className="h-11 border-[rgba(243,235,224,0.12)] bg-black/35 text-[#f3ebe0]"
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
                            ë§Œë“œ??ì¤?..
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            AIë¡?ê·€?¬ìš´ ?¼êµ´ ë§Œë“¤ê¸?                          </>
                        )}
                      </Button>
                      <label className="inline-flex cursor-pointer items-center rounded-md border border-[rgba(243,235,224,0.14)] bg-white/[0.03] px-3 py-2 text-sm font-medium text-[#9aa89c] hover:bg-white/[0.08] hover:text-[#f3ebe0]">
                        <ImageIcon className="mr-2 h-4 w-4" />
                        ?´ë?ì§€ ?…ë¡œ??                        <input
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
                          className="border-[rgba(243,235,224,0.14)] text-[#9aa89c]"
                        >
                          ?ˆí¼?°ìŠ¤ ?œê±°
                        </Button>
                      ) : null}
                    </div>
                    <p className="text-xs text-[#6b7a6e]">
                      ?„ë¦¬???˜í”Œ??ê¸°ë³¸ ?ˆí¼?°ìŠ¤ë¡??¤ì–´ê°€?? AIë¡??¤ì‹œ ë§Œë“¤ê±°ë‚˜ ?…ë¡œ?œí•˜ë©??¼êµ´????ê³ ì •?¼ìš”.
                    </p>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-[rgba(243,235,224,0.12)] bg-black/40">
                    {animalCharacter.referenceImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={animalCharacter.referenceImage}
                        alt={`${animalCharacter.name} ?ˆí¼?°ìŠ¤`}
                        className="h-44 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-44 flex-col items-center justify-center gap-2 text-[#6b7a6e]">
                        <PawPrint className="h-8 w-8" />
                        <span className="text-xs">?ˆí¼?°ìŠ¤ ?†ìŒ</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-2xl border border-[rgba(243,235,224,0.12)] bg-[#121a16]/95 shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-[#7dd3a8]/5 to-[#ff8fab]/5 pointer-events-none" />
              <CardHeader className="relative z-10 border-b border-[rgba(243,235,224,0.1)] pb-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-[#ff8fab]/30 bg-[#ff8fab]/15 p-2 shadow-sm">
                    <ShoppingBag className="h-5 w-5 text-[#ff8fab]" />
                  </div>
                  <div>
                    <p className="animal-bubble-chip inline-flex px-2.5 py-1 text-[10px]">?›ï¸?SHOPPING</p>
                    <CardTitle className="animal-display mt-2 text-xl font-bold text-[#fff6ee]">
                      2. ?¥ë³¼ ?œí’ˆ ê³ ë¥´ê¸?                    </CardTitle>
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
                  <div className="rounded-xl border border-[#ff8fab]/30 bg-[#ff8fab]/10 px-4 py-3">
                    <p className="text-sm font-semibold text-[#fff6ee]">
                      ??{animalCharacter.name}???¼í•‘ ?„ì´?? {selectedCoupangProduct.productName}
                    </p>
                    <p className="mt-1 text-xs text-[#9aa89c]">
                      ì¿ íŒ¡?ì„œ ê³ ë¥¸ ???œí’ˆ???¤ê³ Â·?œìš©?˜ëŠ” ?¥ë©´?¼ë¡œ ?€ë³¸Â·ì´ë¯¸ì?Â·?ìƒ??ë§Œë“¤?´ì ¸??                    </p>
                  </div>
                ) : null}

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="product-name" className="flex items-center gap-2 text-sm font-semibold text-[#d7e0d8]">
                      ?œí’ˆëª?<span className="text-[#c45c3e]">*</span>
                    </Label>
                  </div>
                  <p className="text-xs text-[#6b7a6e]">?? ë¬´ì„  ë¸”ë£¨?¬ìŠ¤ ?´ì–´??Â· ì¿ íŒ¡ ê²€?‰ìœ¼ë¡??ë™ ?…ë ¥?¼ìš”</p>
                  <Input
                    id="product-name"
                    placeholder="?œí’ˆëª…ì„ ?…ë ¥?´ì£¼?¸ìš”"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="h-12 border-[rgba(243,235,224,0.12)] bg-black/35 text-[#f3ebe0] placeholder:text-[#6b7a6e] focus:border-[#7dd3a8]/50"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="product-description" className="text-sm font-semibold text-[#d7e0d8]">
                    ?œí’ˆ ?¤ëª… (? íƒ?¬í•­)
                  </Label>
                  <p className="text-xs text-[#6b7a6e]">
                    ?œí’ˆ??ì£¼ìš” ?¹ì§•, ?¥ì  ?±ì„ ?…ë ¥?´ì£¼?¸ìš”. ë¹„ì›Œ?ë©´ ?œí’ˆëª…ë§Œ?¼ë¡œ ?€ë³¸ì„ ?ì„±?©ë‹ˆ??
                  </p>
                  <Textarea
                    id="product-description"
                    placeholder="?œí’ˆ ?¤ëª…???…ë ¥?´ì£¼?¸ìš”"
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    rows={4}
                    className="resize-none border-[rgba(243,235,224,0.12)] bg-black/35 text-[#f3ebe0] placeholder:text-[#6b7a6e] focus:border-[#7dd3a8]/50"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="video-duration" className="text-sm font-semibold text-[#d7e0d8]">
                    ?ìƒ ê¸¸ì´
                  </Label>
                  <p className="text-xs text-[#6b7a6e]">
                    ?ìƒ ê¸¸ì´ë¥?? íƒ?˜ì„¸?? ? íƒ??ê¸¸ì´??ë§ì¶° ?€ë³¸ì´ ?ì„±?©ë‹ˆ??
                  </p>
                  <Select value={videoDuration.toString()} onValueChange={(value) => setVideoDuration(parseInt(value) as 12 | 15 | 20 | 30)}>
                    <SelectTrigger className="h-12 border-[rgba(243,235,224,0.12)] bg-black/35 text-[#f3ebe0]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[rgba(243,235,224,0.12)] bg-[#121a16] shadow-xl">
                      <SelectItem value="12" className="text-[#f3ebe0]">12ì´?/SelectItem>
                      <SelectItem value="15" className="text-[#f3ebe0]">15ì´?/SelectItem>
                      <SelectItem value="20" className="text-[#f3ebe0]">20ì´?/SelectItem>
                      <SelectItem value="30" className="text-[#f3ebe0]">30ì´?/SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="product-image" className="flex items-center gap-2 text-sm font-semibold text-[#d7e0d8]">
                    ?œí’ˆ ?´ë?ì§€ <span className="text-[#c45c3e]">*</span>
                  </Label>
                  {!productImage ? (
                    <div
                      className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 md:p-12 ${
                        isDragging
                          ? "scale-[1.02] border-[#7dd3a8] bg-[#7dd3a8]/10"
                          : "border-[rgba(125,211,168,0.3)] bg-[#7dd3a8]/5 hover:border-[#7dd3a8]/50"
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
                          <ImageIcon className={`h-12 w-12 ${isDragging ? "text-[#7dd3a8]" : "text-[#7dd3a8]/80"}`} />
                        </div>
                        <div className="space-y-2">
                          <span className={`block text-sm font-semibold md:text-base ${isDragging ? "text-[#7dd3a8]" : "text-[#d7e0d8]"}`}>
                            {isDragging ? "?¬ê¸°???´ë?ì§€ë¥??“ì•„ì£¼ì„¸?? : "?œí’ˆ ?´ë?ì§€ë¥??…ë¡œ?œí•˜ê±°ë‚˜ ì¿ íŒ¡?ì„œ ? íƒ?˜ì„¸??}
                          </span>
                          <span className="block text-xs text-[#6b7a6e]">
                            ?´ë?ì§€ë¥??´ë¦­?˜ê±°???œë˜ê·¸í•˜???…ë¡œ??                          </span>
                          <span className="block text-xs text-[#6b7a6e]">
                            PNG, JPG, GIF (ìµœë? 10MB)
                          </span>
                        </div>
                      </label>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="relative h-64 w-full overflow-hidden rounded-2xl border-2 border-[rgba(125,211,168,0.3)] bg-white/95 shadow-xl">
                        <img
                          src={productImageDisplayUrl(productImage)}
                          alt="?œí’ˆ ?´ë?ì§€"
                          className="h-full w-full object-contain"
                        />
                        <button
                          onClick={handleRemoveImage}
                          className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-red-500 to-red-600 p-2.5 text-white shadow-lg transition-all hover:scale-110 hover:from-red-600 hover:to-red-700"
                          type="button"
                          aria-label="?´ë?ì§€ ?œê±°"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-3 text-center text-xs text-[#6b7a6e]">
                        {selectedCoupangProduct
                          ? `${animalCharacter.name}??ê°€) ??ì¿ íŒ¡ ?í’ˆ???¤ê³  ?¼í•‘?˜ëŠ” ?¥ë©´?¼ë¡œ ?ì„±?©ë‹ˆ??
                          : "?´ë?ì§€ê°€ ?…ë¡œ?œë˜?ˆìŠµ?ˆë‹¤. ?¤ë¥¸ ?´ë?ì§€ë¥??…ë¡œ?œí•˜?¤ë©´ ?œê±° ???¤ì‹œ ?…ë¡œ?œí•˜?¸ìš”."}
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
                      AIê°€ ?€ë³¸ì„ ?ì„±?˜ê³  ?ˆìŠµ?ˆë‹¤...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      {selectedCoupangProduct
                        ? `${animalCharacter.name}??ê°€) ì¿ íŒ¡ ?œí’ˆ ?¤ê³  ?€ë³?ë§Œë“¤ê¸?
                        : "?€ë³??ì„±?˜ê¸°"}
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
                ?ì„±???€ë³?              </h2>
              <p className="text-slate-600 text-base">?€ë³¸ì„ ?•ì¸?˜ê³  ?˜ì •?????ˆìŠµ?ˆë‹¤</p>
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
                      ?€ë³?({videoDuration}ì´?
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
                        ?¸ì§‘
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
                          ì·¨ì†Œ
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleSaveEditedScript}
                          className="text-sm bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-semibold shadow-md"
                        >
                          ?€??                        </Button>
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
                          ?¬ìƒ??ì¤?..
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          ?€ë³??¬ìƒ??                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 relative z-10">
                {/* ?„ì²´ ?€ë³??œì‹œ */}
                <div>
                  <Label className="text-sm font-semibold text-slate-700 mb-2 block">?„ì²´ ?€ë³?/Label>
                  <Textarea
                    value={isEditingScript ? editedScript : script}
                    onChange={(e) => isEditingScript ? setEditedScript(e.target.value) : setScript(e.target.value)}
                    rows={8}
                    className="font-medium bg-gradient-to-br from-orange-50/90 to-amber-50/70 border-orange-200 text-slate-900 placeholder:text-slate-400 focus:border-orange-400 focus:ring-orange-400/20 resize-none shadow-sm"
                    placeholder="?€ë³¸ì´ ?¬ê¸°???œì‹œ?©ë‹ˆ??.."
                    disabled={!isEditingScript && !script}
                  />
                </div>
                
                {isAnalyzingScript && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>?€ë³¸ì„ ë¶„ì„?˜ê³  ?ˆìŠµ?ˆë‹¤...</span>
                  </div>
                )}
                
                {/* ?€ë³??ŒíŠ¸ë³?ë¶„ì„ ê²°ê³¼ */}
                {script && scriptParts.length > 0 && !isEditingScript && (
                  <div className="space-y-3 pt-4 border-t border-orange-100">
                    <Label className="text-sm font-semibold text-slate-700 mb-3 block">?€ë³?ë¶„ì„</Label>
                    <div className="space-y-3">
                      {scriptParts.map((part, index) => {
                        const partColors: Record<string, { bg: string; border: string; text: string; label: string }> = {
                          "?¸íŠ¸ë¡??„í‚¹": { bg: "from-pink-50 to-rose-50", border: "border-pink-300", text: "text-pink-700", label: "?¸íŠ¸ë¡??„í‚¹" },
                          "?œí’ˆ ?Œê°œ": { bg: "from-blue-50 to-cyan-50", border: "border-blue-300", text: "text-blue-700", label: "?œí’ˆ ?Œê°œ" },
                          "?œí’ˆ ?¥ì ": { bg: "from-green-50 to-emerald-50", border: "border-green-300", text: "text-green-700", label: "?œí’ˆ ?¥ì " },
                          "ë§ˆë¬´ë¦?: { bg: "from-purple-50 to-indigo-50", border: "border-purple-300", text: "text-purple-700", label: "ë§ˆë¬´ë¦? },
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
                    ?´ì „
                  </Button>
                  <Button
                    onClick={handleGoToImageGeneration}
                    disabled={!script.trim()}
                    className="flex-1 bg-gradient-to-r from-green-500 via-emerald-500 to-green-500 hover:from-green-400 hover:via-emerald-400 hover:to-green-400 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/50 hover:shadow-xl hover:shadow-green-500/50 transition-all duration-300"
                    size="lg"
                  >
                    <ImageIcon className="w-5 h-5 mr-2" />
                    ?´ë?ì§€ ?ì„±?˜ê¸°
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
                ?´ë?ì§€ ?ì„±
              </h2>
              <p className="text-slate-600 text-base">AIê°€ ?´ë?ì§€ë¥??ì„±?©ë‹ˆ??/p>
            </div>

            {isGeneratingVideo ? (
              /* ?´ë?ì§€ ?ì„± ? ë‹ˆë©”ì´?? ?ë³¸ ?´ë?ì§€ê°€ ?ì„±???´ë?ì§€ë¡?ë³€??*/
              productImage ? (
                <Card className="border border-green-200/50 rounded-2xl shadow-2xl bg-white/80 backdrop-blur-xl overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 to-emerald-50/30"></div>
                  <CardHeader className="relative z-10 border-b border-green-100">
                    <CardTitle className="text-xl font-bold text-slate-800">?´ë?ì§€ ?ì„± ì¤?..</CardTitle>
                  </CardHeader>
                  <CardContent className="py-6 relative z-10">
                    <div className="flex items-center justify-center gap-8 flex-wrap">
                      {/* ?ë³¸ ?´ë?ì§€ */}
                      <div className="space-y-3 text-center">
                        <Label className="text-sm font-semibold text-slate-700">?ë³¸ ?´ë?ì§€</Label>
                        <div className="relative w-48 aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-blue-300 shadow-lg">
                          <img
                            src={productImage}
                            alt="?ë³¸ ?œí’ˆ ?´ë?ì§€"
                            className={`w-full h-full opacity-70 transition-opacity duration-1000 ${
                              productImageAspectRatio !== null && Math.abs(productImageAspectRatio - 1) < 0.1
                                ? "object-contain" // 1:1 ë¹„ìœ¨???ŒëŠ” ì¶•ì†Œ?´ì„œ ?„ì²´ ?œì‹œ (?í•˜ ?¬ë°± ?ê?)
                                : "object-cover" // ê·??¸ì—??ê¸°ì¡´?€ë¡?                            }`}
                          />
                        </div>
                      </div>

                      {/* AI ë³€??? ë‹ˆë©”ì´??*/}
                      <div className="flex flex-col items-center justify-center relative">
                        {/* ?”ì‚´??*/}
                        <div className="relative">
                          <ArrowRight className="w-16 h-16 text-green-500 animate-pulse" />
                          {/* AI ?ì„± ?¨ê³¼ - Sparkles */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <Sparkles className="w-8 h-8 text-green-400 animate-bounce absolute -top-2 -left-2" style={{ animationDelay: '0s' }} />
                            <Sparkles className="w-6 h-6 text-emerald-400 animate-bounce absolute -top-1 -right-1" style={{ animationDelay: '0.2s' }} />
                            <Sparkles className="w-5 h-5 text-green-300 animate-bounce absolute -bottom-1 -left-1" style={{ animationDelay: '0.4s' }} />
                            <Sparkles className="w-7 h-7 text-emerald-300 animate-bounce absolute -bottom-2 -right-2" style={{ animationDelay: '0.6s' }} />
                          </div>
                          {/* ?Œì „?˜ëŠ” ë¡œë”© ë§?*/}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                          {/* Bot ?„ì´ì½?*/}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Bot className="w-6 h-6 text-green-600 animate-pulse" />
                          </div>
                        </div>
                        <span className="text-xs text-slate-500 mt-3 font-medium">AIê°€ ?´ë?ì§€ë¥??ì„± ì¤?..</span>
                      </div>

                      {/* ?ì„± ì¤‘ì¸ ?´ë?ì§€ */}
                      <div className="space-y-3 text-center">
                        <Label className="text-sm font-semibold text-slate-700">?ì„± ì¤?..</Label>
                        <div className="relative w-48 aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-green-500 shadow-lg">
                          {/* ê·¸ë¼?°ì´??ë°°ê²½ ? ë‹ˆë©”ì´??*/}
                          <div className="absolute inset-0 bg-gradient-to-br from-green-200/50 via-emerald-200/50 to-green-300/50 animate-pulse"></div>
                          {/* ?Œí‹°???¨ê³¼ */}
                          <div className="absolute inset-0">
                            <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-green-400 rounded-full animate-ping" style={{ animationDelay: '0s' }}></div>
                            <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-emerald-400 rounded-full animate-ping" style={{ animationDelay: '0.3s' }}></div>
                            <div className="absolute bottom-1/4 left-1/2 w-2 h-2 bg-green-300 rounded-full animate-ping" style={{ animationDelay: '0.6s' }}></div>
                            <div className="absolute bottom-1/3 right-1/3 w-2 h-2 bg-emerald-300 rounded-full animate-ping" style={{ animationDelay: '0.9s' }}></div>
                          </div>
                          {/* ì¤‘ì•™ ë¡œë”© ?¤í”¼??*/}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="relative">
                              <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
                              <Sparkles className="w-4 h-4 text-green-400 absolute -top-1 -right-1 animate-bounce" />
                            </div>
                          </div>
                          {/* ?˜ë‹¨ ?ìŠ¤??*/}
                          <div className="absolute bottom-2 left-2 right-2 text-[10px] text-green-600 font-medium bg-white/90 px-2 py-1 rounded text-center">
                            AI ?ì„± ì¤?..
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
                        <h3 className="text-xl font-semibold mb-2">?´ë?ì§€ ?ì„± ì¤?..</h3>
                        <p className="text-muted-foreground mb-4">
                          AIê°€ ?´ë?ì§€ë¥??ì„±?˜ê³  ?ˆìŠµ?ˆë‹¤
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            ) : imageUrls.length > 0 && productImage ? (
              /* ?ì„± ?„ë£Œ: ?ë³¸ ?´ë?ì§€?€ ?ì„±??3?¥ì˜ ?´ë?ì§€ */
              <Card className="border border-green-200/50 rounded-2xl shadow-2xl bg-white/80 backdrop-blur-xl overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 to-emerald-50/30"></div>
                <CardHeader className="relative z-10 border-b border-green-100">
                  <CardTitle className="text-xl font-bold text-slate-800">?´ë?ì§€ ?ì„± ?„ë£Œ (1??</CardTitle>
                </CardHeader>
                <CardContent className="py-6 relative z-10">
                  <div className="space-y-6">
                    {/* ?ë³¸ ?´ë?ì§€?€ ?ì„±???´ë?ì§€ ì¢Œìš° ë°°ì¹˜ */}
                    <div className="flex items-center justify-center gap-8 flex-wrap">
                      {/* ?ë³¸ ?´ë?ì§€ */}
                      <div className="space-y-3 text-center">
                        <Label className="text-sm font-semibold text-slate-700">?ë³¸ ?´ë?ì§€</Label>
                        <div className="relative w-48 aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-blue-300 shadow-lg">
                          <img
                            src={productImage}
                            alt="?ë³¸ ?œí’ˆ ?´ë?ì§€"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>

                      {/* ?”ì‚´??*/}
                      <div className="flex flex-col items-center justify-center">
                        <ArrowRight className="w-16 h-16 text-green-500" />
                        <span className="text-xs text-slate-500 mt-2 font-medium">AI ë³€??/span>
                      </div>

                      {/* ?ì„±???´ë?ì§€ (3ê°? */}
                      <div className="space-y-3 text-center">
                        <Label className="text-sm font-semibold text-slate-700">?ì„±???´ë?ì§€ (3ê°?</Label>
                        <div className="flex gap-4 justify-center flex-wrap">
                          {imageUrls.map((url, index) => (
                            <div key={index} className="space-y-2">
                              <div className="flex items-center justify-center gap-2">
                                <Label className="text-xs font-medium text-slate-600">
                                  {imagePrompts[index]?.type || `?´ë?ì§€ ${index + 1}`}
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
                                      ?¬ìƒ??ì¤?                                    </>
                                  ) : (
                                    <>
                                      <RefreshCw className="w-2.5 h-2.5 mr-1" />
                                      ?¬ìƒ??                                    </>
                                  )}
                                </Button>
                              </div>
                              {/* ì¶”ê? ?„ë¡¬?„íŠ¸ ?…ë ¥ ?„ë“œ */}
                              <div className="space-y-1 w-48">
                                <Label className="text-[10px] text-slate-600">ì¶”ê? ?„ë¡¬?„íŠ¸</Label>
                                <Input
                                  type="text"
                                  placeholder="?? ë°ì? ì¡°ëª…, ?ì—°?¤ëŸ¬??ë°°ê²½"
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
                                      alt={`?ì„±???´ë?ì§€ ${index + 1}`}
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
                                        ?¬ìƒ??ì¤?..
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <img
                                    src={url}
                                    alt={`?ì„±???´ë?ì§€ ${index + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                                <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                                  {index + 1}
                                </div>
                                <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs font-medium px-2 py-1 rounded">
                                  {imagePrompts[index]?.type || `?´ë?ì§€ ${index + 1}`}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* ?´ë?ì§€ ?„ë¡¬?„íŠ¸ ?œì‹œ (Collapsible) */}
                    {imagePrompts.length > 0 && (
                      <div className="pt-4 border-t border-green-200">
                        <Collapsible>
                          <CollapsibleTrigger className="w-full group">
                            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all">
                              <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-blue-600" />
                                <span className="text-sm font-semibold text-blue-700">?´ë?ì§€ ?„ë¡¬?„íŠ¸ ë³´ê¸°</span>
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
                                      <p className="text-xs font-medium text-slate-700 mb-1">?€ë³?ë¶€ë¶?</p>
                                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
                                        {prompt.scriptText}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-slate-700 mb-1">?„ë¡¬?„íŠ¸:</p>
                                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 font-mono break-words">
                                        {prompt.prompt}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-slate-700 mb-1">?¤ëª…:</p>
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
                      ?´ì „
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
                          ?¬ìƒ??ì¤?..
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          ?¬ìƒ??                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => setActiveStep("render")}
                      className="bg-gradient-to-r from-green-500 via-emerald-500 to-green-500 hover:from-green-400 hover:via-emerald-400 hover:to-green-400 text-white font-bold shadow-lg shadow-green-500/50 hover:shadow-xl hover:shadow-green-500/50 transition-all duration-300"
                      size="lg"
                    >
                      ?¤ìŒ ?¨ê³„ë¡?                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* ?´ë?ì§€ ?ì„± ?œì‘ ?”ë©´ */
              <Card className="border border-green-200/50 rounded-2xl shadow-2xl bg-white/80 backdrop-blur-xl overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 to-emerald-50/30"></div>
                <CardHeader className="relative z-10 border-b border-green-100">
                  <CardTitle className="text-xl font-bold text-slate-800">?´ë?ì§€ ?ì„± ì¤€ë¹?/CardTitle>
                </CardHeader>
                <CardContent className="py-6 relative z-10">
                  {productImage ? (
                    <div className="space-y-6">
                      <div className="text-center">
                        <p className="text-slate-600 mb-4">?…ë¡œ?œëœ ?œí’ˆ ?´ë?ì§€ë¥?ê¸°ë°˜?¼ë¡œ AIê°€ ?ˆë¡œ???´ë?ì§€ë¥??ì„±?©ë‹ˆ??</p>
                        <div className="flex justify-center mb-6">
                          <div className="relative w-48 aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-green-300 shadow-lg">
                            <img
                              src={productImage}
                              alt="?œí’ˆ ?´ë?ì§€"
                              className={`w-full h-full ${
                                productImageAspectRatio !== null && Math.abs(productImageAspectRatio - 1) < 0.1
                                  ? "object-contain" // 1:1 ë¹„ìœ¨???ŒëŠ” ì¶•ì†Œ?´ì„œ ?„ì²´ ?œì‹œ (?í•˜ ?¬ë°± ?ê?)
                                  : "object-cover" // ê·??¸ì—??ê¸°ì¡´?€ë¡?                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* ?„ë¡¬?„íŠ¸ ?ì„± ?¨ê³„ */}
                      {!promptsGenerated ? (
                        <div className="space-y-4">
                          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                            <p className="text-sm text-blue-700 mb-3">
                              <strong>1?¨ê³„:</strong> ?€ë³¸ì„ ë¶„ì„?˜ì—¬ ?´ë?ì§€ ?„ë¡¬?„íŠ¸ë¥??ì„±?©ë‹ˆ??
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
                                  ?„ë¡¬?„íŠ¸ ?ì„± ì¤?..
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-5 h-5 mr-2" />
                                  ?´ë?ì§€ ?„ë¡¬?„íŠ¸ ?ì„±?˜ê¸°
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* ?ì„±???„ë¡¬?„íŠ¸ ?œì‹œ */}
                          <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                            <div className="flex items-center gap-2 mb-3">
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                              <p className="text-sm font-semibold text-green-700">?„ë¡¬?„íŠ¸ ?ì„± ?„ë£Œ (3ê°?</p>
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
                                      <p className="text-xs font-medium text-slate-700 mb-1">?€ë³?ë¶€ë¶?</p>
                                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
                                        {prompt.scriptText}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-slate-700 mb-1">?„ë¡¬?„íŠ¸:</p>
                                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 font-mono break-words">
                                        {prompt.prompt}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-slate-700 mb-1">?¤ëª…:</p>
                                      <p className="text-xs text-slate-500 italic">
                                        {prompt.description}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* ?´ë?ì§€ ?ì„± ë²„íŠ¼ */}
                          <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                            <p className="text-sm text-purple-700 mb-3">
                              <strong>2?¨ê³„:</strong> ?ì„±???„ë¡¬?„íŠ¸ë¥??¬ìš©?˜ì—¬ ?´ë?ì§€ë¥??ì„±?©ë‹ˆ??
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
                                  ?´ë?ì§€ ?ì„± ì¤?..
                                </>
                              ) : (
                                <>
                                  <ImageIcon className="w-5 h-5 mr-2" />
                                  ?´ë?ì§€ ?ì„±?˜ê¸°
                                </>
                              )}
                            </Button>
                          </div>

                          {/* ?„ë¡¬?„íŠ¸ ?¬ìƒ??ë²„íŠ¼ */}
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
                            ?„ë¡¬?„íŠ¸ ?¤ì‹œ ?ì„±?˜ê¸°
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-slate-600 mb-4">?œí’ˆ ?´ë?ì§€ê°€ ?„ìš”?©ë‹ˆ??</p>
                      <Button
                        onClick={() => setActiveStep("product")}
                        variant="outline"
                        className="border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 hover:from-green-100 hover:to-emerald-100 hover:text-green-800 hover:border-green-400 font-semibold shadow-md"
                      >
                        ?œí’ˆ ?•ë³´ë¡??Œì•„ê°€ê¸?                      </Button>
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
              <p className="animal-bubble-chip inline-flex px-2.5 py-1 text-[10px]">?‚ï¸ PET CAPCUT</p>
              <h2 className="animal-display text-3xl font-bold text-[#fff6ee]">ìº¡ì»· ?¤í????¸ì§‘</h2>
              <p className="text-sm text-[#9aa89c]">?€?„ë¼??Â· ?ë§‰ Â· BGM/SFX Â· ë¯¸ë¦¬ë³´ê¸° Â· ?´ë³´?´ê¸°</p>
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
                      alt="?¸ë„¤??
                      className="absolute inset-0 z-[5] h-full w-full object-cover"
                    />
                  ) : null}
                </>
              }
              audioPanel={
                <div className="space-y-5 text-[#d7e0d8]">
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">ë°°ê²½?Œì•… (BGM)</Label>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleBgmUpload}
                        className="flex-1 text-xs text-[#9aa89c] file:mr-3 file:rounded-full file:border-0 file:bg-[#7dd3a8]/20 file:px-3 file:py-1.5 file:text-[#7dd3a8]"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowBgmLibraryDialog(true)} className="border-[rgba(255,246,238,0.14)] text-[#d7e0d8]">
                        <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
                        ?¼ì´ë¸ŒëŸ¬ë¦?                      </Button>
                    </div>
                    {bgmUrl ? (
                      <div className="space-y-2 rounded-xl border border-[#7dd3a8]/25 bg-[#7dd3a8]/10 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#7dd3a8]">BGM ?ìš©??/span>
                          <Button type="button" size="sm" variant="destructive" onClick={handleDeleteBgm}>?? œ</Button>
                        </div>
                        <audio controls src={bgmUrl} className="w-full" />
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <Label className="text-xs text-[#9aa89c]">BGM ë³¼ë¥¨ {Math.round(bgmVolume * 100)}%</Label>
                      <Slider value={[bgmVolume]} min={0} max={1} step={0.1} onValueChange={([v]) => setBgmVolume(v ?? 0.3)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-[#9aa89c]">TTS ë³¼ë¥¨ {Math.round(ttsVolume * 100)}%</Label>
                      <Slider value={[ttsVolume]} min={0} max={1} step={0.1} onValueChange={([v]) => setTtsVolume(v ?? 1)} />
                    </div>
                    {bgmUrl ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-[#9aa89c]">?œì‘(ì´?</Label>
                          <Input type="number" value={bgmStartTime} min={0} step={0.1} onChange={(e) => setBgmStartTime(Math.max(0, parseFloat(e.target.value) || 0))} className="mt-1 border-[rgba(243,235,224,0.12)] bg-black/35 text-[#f3ebe0]" />
                        </div>
                        <div>
                          <Label className="text-xs text-[#9aa89c]">ì¢…ë£Œ(ì´?</Label>
                          <Input type="number" value={bgmEndTime} min={0} step={0.1} onChange={(e) => setBgmEndTime(Math.max(0, parseFloat(e.target.value) || 0))} className="mt-1 border-[rgba(243,235,224,0.12)] bg-black/35 text-[#f3ebe0]" />
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-3 border-t border-[rgba(255,246,238,0.08)] pt-4">
                    <Label className="text-sm font-semibold">?¨ê³¼??(SFX)</Label>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleSfxUpload}
                        className="flex-1 text-xs text-[#9aa89c] file:mr-3 file:rounded-full file:border-0 file:bg-[#ff8fab]/20 file:px-3 file:py-1.5 file:text-[#ff8fab]"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowSfxLibraryDialog(true)} className="border-[rgba(255,246,238,0.14)] text-[#d7e0d8]">
                        <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
                        ?¼ì´ë¸ŒëŸ¬ë¦?                      </Button>
                    </div>
                    {sfxUrl ? (
                      <div className="space-y-2 rounded-xl border border-[#ff8fab]/25 bg-[#ff8fab]/10 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#ff8fab]">SFX ?ìš©??/span>
                          <Button type="button" size="sm" variant="destructive" onClick={handleDeleteSfx}>?? œ</Button>
                        </div>
                        <audio controls src={sfxUrl} className="w-full" />
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <Label className="text-xs text-[#9aa89c]">SFX ë³¼ë¥¨ {Math.round(sfxVolume * 100)}%</Label>
                      <Slider value={[sfxVolume]} min={0} max={1} step={0.1} onValueChange={([v]) => setSfxVolume(v ?? 0.5)} />
                    </div>
                    {sfxUrl ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-[#9aa89c]">?œì‘(ì´?</Label>
                          <Input type="number" value={sfxStartTime} min={0} step={0.1} onChange={(e) => setSfxStartTime(Math.max(0, parseFloat(e.target.value) || 0))} className="mt-1 border-[rgba(243,235,224,0.12)] bg-black/35 text-[#f3ebe0]" />
                        </div>
                        <div>
                          <Label className="text-xs text-[#9aa89c]">ì¢…ë£Œ(ì´?</Label>
                          <Input type="number" value={sfxEndTime} min={0} step={0.1} onChange={(e) => setSfxEndTime(Math.max(0, parseFloat(e.target.value) || 0))} className="mt-1 border-[rgba(243,235,224,0.12)] bg-black/35 text-[#f3ebe0]" />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              }
              metaPanel={
                <div className="space-y-4 text-[#d7e0d8]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">? íŠœë¸?ë©”í??°ì´??/p>
                    <Button type="button" size="sm" onClick={() => void handleGenerateMetadata()} disabled={isGeneratingMetadata || !productName.trim()} className="animal-mint-btn rounded-full">
                      {isGeneratingMetadata ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                      AI ?ì„±
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-[#9aa89c]">?œëª©</Label>
                    <Input value={youtubeTitle} onChange={(e) => setYoutubeTitle(e.target.value)} className="border-[rgba(243,235,224,0.12)] bg-black/35 text-[#f3ebe0]" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-[#9aa89c]">?¤ëª…</Label>
                    <Textarea value={youtubeDescription} onChange={(e) => setYoutubeDescription(e.target.value)} rows={4} className="resize-none border-[rgba(243,235,224,0.12)] bg-black/35 text-[#f3ebe0]" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-[#9aa89c]">?œê·¸</Label>
                    <Input value={youtubeTags.join(", ")} onChange={(e) => setYoutubeTags(e.target.value.split(",").map((t) => t.trim()).filter(Boolean))} className="border-[rgba(243,235,224,0.12)] bg-black/35 text-[#f3ebe0]" placeholder="?¼í‘œë¡?êµ¬ë¶„" />
                  </div>
                </div>
              }
              exportActions={
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {videoUrl ? (
                    <Button onClick={handleDownload} className="bg-[#7dd3a8] text-[#0d1a14] hover:bg-[#6bc497]" size="lg">
                      <Download className="mr-2 h-4 w-4" />
                      ?ìƒ ?¤ìš´ë¡œë“œ
                    </Button>
                  ) : (
                    <Button onClick={() => handleRenderVideo()} disabled={isRendering || !previewGenerated} className="bg-[#ff8fab] text-white hover:bg-[#ff7a9a] disabled:opacity-50" size="lg">
                      {isRendering && !isScheduling ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />?Œë”ë§?ì¤?..</>
                      ) : (
                        <><Download className="mr-2 h-4 w-4" />?ìƒ ?¤ìš´ë¡œë“œ</>
                      )}
                    </Button>
                  )}
                  <Button onClick={handleServerDownload} disabled={!previewGenerated || isServerDownloading} variant="outline" className="border-[rgba(255,246,238,0.14)] text-[#d7e0d8]" size="lg">
                    {isServerDownloading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />?œë²„ ?Œë”ë§?ì¤?..</>
                    ) : (
                      <><Download className="mr-2 h-4 w-4" />?œë²„ ?¤ìš´ë¡œë“œ</>
                    )}
                  </Button>
                  {serverDownloadLink ? (
                    <a href={serverDownloadLink.url} download={serverDownloadLink.fileName} target="_blank" rel="noopener noreferrer" className="col-span-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#7dd3a8] py-3 font-semibold text-[#0d1a14]">
                      <Download className="h-5 w-5" />
                      ?ìƒ ?€??(??•˜???¤ìš´ë¡œë“œ)
                    </a>
                  ) : null}
                  <Button onClick={handleOpenScheduleModal} disabled={isRendering || !previewGenerated} variant="outline" className="border-[#ff8fab]/40 text-[#ff8fab]" size="lg">
                    {isScheduling ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />?ˆì•½ ?ì„± ì¤?..</> : <><CalendarClock className="mr-2 h-4 w-4" />?ˆì•½ ë°œí–‰</>}
                  </Button>
                </div>
              }
            />

            <div className="flex gap-3 border-t border-[rgba(255,246,238,0.08)] pt-4">
              <Button variant="outline" onClick={() => setActiveStep("thumbnail")} className="flex-1 border-[rgba(255,246,238,0.14)] text-[#d7e0d8]">
                <ArrowLeft className="mr-2 h-4 w-4" />
                ?´ì „ Â· ?¸ë„¤??              </Button>
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
                ì²˜ìŒ?¼ë¡œ
              </Button>
            </div>
          </div>
        )

      case "render":
        return (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                ?ìƒ ?ì„±
              </h2>
              <p className="text-slate-600 text-base">?ìƒ ?¤ì •??êµ¬ì„±?˜ê³  ?ì„±?˜ì„¸??/p>
            </div>

            {/* ?ì„±???ìƒ ?¤ì‹œê°??œì‹œ */}
            {/* ?ìƒ???˜ë‚˜?¼ë„ ?ì„± ì¤‘ì´ê±°ë‚˜ ?ì„±??ê²½ìš° ?œì‹œ */}
            {(convertedVideoUrls.size > 0 || isConvertingToVideo.get(0) || isConvertingToVideo.get(1) || isConvertingToVideo.get(2)) && (
              <Card className="border border-blue-200 rounded-2xl shadow-lg bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="w-5 h-5 text-blue-600" />
                    ê°œë³„ ?ìƒ ?ì„± ì¤?({convertedVideoUrls.size}/3)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[0, 1, 2].map((index) => {
                      const videoUrl = convertedVideoUrls.get(index)
                      const isConverting = isConvertingToVideo.get(index)
                      const isGeneratingPrompt = isGeneratingVideoPrompts.get(index)
                      const videoPrompt = videoPrompts.get(index)
                      const sceneNames = ["?œí’ˆ ?¬ìš© ?ìƒ", "?”í…Œ???ìƒ", "?¤ë¥¸ ë°°ê²½ ?ìƒ"]
                      
                      // ?ì„± ?„ë£Œ???ìƒ
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
                                    ?ì„± ì¤?                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="w-3 h-3 mr-1" />
                                    ?¬ìƒ??                                  </>
                                )}
                              </Button>
                            </div>
                            {/* ?ìƒ ?„ë¡¬?„íŠ¸ ?œì‹œ (Collapsible) */}
                            {videoPrompt && (
                              <Collapsible>
                                <CollapsibleTrigger className="w-full">
                                  <div className="flex items-center justify-between w-full p-2 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors">
                                    <span className="text-xs font-semibold text-blue-700">?ìƒ ?„ë¡¬?„íŠ¸ ë³´ê¸°</span>
                                    <ChevronDown className="w-4 h-4 text-blue-600" />
                                  </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <p className="text-xs font-medium text-slate-700 mb-1">?„ë¡¬?„íŠ¸:</p>
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
                                ??{index + 1}
                              </div>
                            </div>
                          </div>
                        )
                      }
                      
                      // ?ì„± ì¤‘ì¸ ?ìƒ
                      if (isConverting || isGeneratingPrompt) {
                        const statusText = isGeneratingPrompt 
                          ? "?„ë¡¬?„íŠ¸ ?ì„± ì¤?.." 
                          : "?ìƒ ?ì„± ì¤?.."
                        
                        return (
                          <div key={index} className="space-y-2">
                            <Label className="text-sm font-semibold text-slate-700">{sceneNames[index]} ({statusText})</Label>
                            {/* ?„ë¡¬?„íŠ¸ ?ì„± ì¤‘ì¼ ???„ë¡¬?„íŠ¸ ?œì‹œ */}
                            {isGeneratingPrompt && (
                              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="flex items-center gap-2">
                                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                                  <p className="text-xs text-blue-600 font-medium">?ìƒ ?„ë¡¬?„íŠ¸ ?ì„±ì¤?/p>
                                </div>
                              </div>
                            )}
                            {/* ?ì„±???„ë¡¬?„íŠ¸ ?œì‹œ (?ìƒ ?ì„± ì¤‘ì¼ ?? */}
                            {videoPrompt && !isGeneratingPrompt && (
                              <Collapsible>
                                <CollapsibleTrigger className="w-full">
                                  <div className="flex items-center justify-between w-full p-2 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors">
                                    <span className="text-xs font-semibold text-green-700">?ì„±???„ë¡¬?„íŠ¸ ë³´ê¸°</span>
                                    <ChevronDown className="w-4 h-4 text-green-600" />
                                  </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <p className="text-xs font-medium text-slate-700 mb-1">?„ë¡¬?„íŠ¸:</p>
                                    <p className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-200 font-mono break-words max-h-40 overflow-y-auto">
                                      {videoPrompt}
                                    </p>
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            )}
                            <div className="relative w-full aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-blue-500 shadow-lg">
                              {/* ?ë³¸ ?´ë?ì§€ ë°°ê²½ */}
                              {imageUrls[index] && (
                                <img
                                  src={imageUrls[index]}
                                  alt={`?ë³¸ ?´ë?ì§€ ${index + 1}`}
                                  className="w-full h-full object-cover opacity-50"
                                />
                              )}
                              {/* ë¡œë”© ?¤ë²„?ˆì´ */}
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
                      
                      // ?„ì§ ?œì‘?˜ì? ?Šì? ?ìƒ (?ë³¸ ?´ë?ì§€ ?œì‹œ)
                      return (
                        <div key={index} className="space-y-2">
                          <Label className="text-sm font-semibold text-slate-700">{sceneNames[index]} (?€ê¸?ì¤?</Label>
                          <div className="relative w-full aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-300 shadow-lg">
                            {imageUrls[index] ? (
                              <img
                                src={imageUrls[index]}
                                alt={`?ë³¸ ?´ë?ì§€ ${index + 1}`}
                                className="w-full h-full object-cover opacity-70"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                <span className="text-gray-400 text-sm">?´ë?ì§€ ?†ìŒ</span>
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
            

            {/* ?ìƒ???†ì„ ??*/}
            {convertedVideoUrls.size === 0 && (
              <Card className="border border-gray-200 rounded-2xl shadow-sm bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    ?ì„±???´ë?ì§€
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {imageUrls.length > 0 ? (
                    <div className="space-y-6">
                      {/* ?´ë?ì§€ ?œì‹œ (3ê°? */}
                      <div className="flex justify-center">
                        <div className="space-y-4 w-full max-w-4xl">
                          <Label className="text-sm font-semibold text-slate-700 text-center block">?ì„±???´ë?ì§€ (3ê°?</Label>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {imageUrls.map((url, index) => (
                              <div key={index} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm font-semibold text-slate-700">
                                    {imagePrompts[index]?.type || `?´ë?ì§€ ${index + 1}`}
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
                                        ?¬ìƒ??ì¤?                                      </>
                                    ) : (
                                      <>
                                        <RefreshCw className="w-3 h-3 mr-1" />
                                        ?¬ìƒ??                                      </>
                                    )}
                                  </Button>
                                </div>
                                {/* ì¶”ê? ?„ë¡¬?„íŠ¸ ?…ë ¥ ?„ë“œ */}
                                <div className="space-y-1">
                                  <Label className="text-xs text-slate-600">ì¶”ê? ?„ë¡¬?„íŠ¸ (?œêµ­??</Label>
                                  <Input
                                    type="text"
                                    placeholder="?? ë°ì? ì¡°ëª…, ?ì—°?¤ëŸ¬??ë°°ê²½, ê³ ê¸‰?¤ëŸ¬???ë‚Œ"
                                    value={customImagePrompts.get(index) || ""}
                                    onChange={(e) => {
                                      const newMap = new Map(customImagePrompts)
                                      newMap.set(index, e.target.value)
                                      setCustomImagePrompts(newMap)
                                    }}
                                    className="h-8 text-xs"
                                  />
                                  <p className="text-[10px] text-slate-500">
                                    ?¬ìƒ????ê¸°ì¡´ ?„ë¡¬?„íŠ¸??ì¶”ê??©ë‹ˆ??                                  </p>
                                </div>
                                <div className="relative w-full aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200 shadow-sm">
                                  {isRegeneratingImage.get(index) ? (
                                    <>
                                      <img
                                        src={url}
                                        alt={`?ì„±???´ë?ì§€ ${index + 1}`}
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
                                          AIê°€ ?´ë?ì§€ë¥??¬ìƒ??ì¤?..
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <img
                                      src={url}
                                      alt={`?ì„±???´ë?ì§€ ${index + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                                    {index + 1}
                                  </div>
                                  <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs font-medium px-2 py-1 rounded">
                                    {imagePrompts[index]?.type || `?´ë?ì§€ ${index + 1}`}
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
                      <p className="text-slate-600 text-base">?´ë?ì§€ê°€ ?ì„±?˜ì? ?Šì•˜?µë‹ˆ??</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ?ìƒ ?ì„±/?¬ìƒ??ë²„íŠ¼ */}
            {imageUrls.length > 0 && (
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setActiveStep("video")
                    // ?ìƒ ?ì„± ?íƒœ ì´ˆê¸°??(?¨ê³„ ?„í™˜ ??
                    setIsConvertingToVideo(new Map())
                  }}
                  className="flex-1 border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 hover:from-orange-100 hover:to-amber-100 hover:text-orange-800 hover:border-orange-400 font-semibold shadow-md transition-all"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  ?´ì „
                </Button>
                <Button
                  onClick={() => setActiveStep("thumbnail")}
                  disabled={convertedVideoUrls.size < 3}
                  className="flex-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 hover:from-purple-400 hover:via-pink-400 hover:to-purple-400 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/50 transition-all duration-300"
                  size="lg"
                >
                  ?¤ìŒ
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                {/* ?ìƒ ?ì„±/?¬ìƒ??ë²„íŠ¼ */}
                {convertedVideoUrls.size === 3 ? (
                  // ëª¨ë“  ?ìƒ???ì„±??ê²½ìš°: ?¬ìƒ??ë²„íŠ¼
                  <Button
                    onClick={() => {
                      // ?¬ìƒ????ê¸°ì¡´ ?ìƒ ì´ˆê¸°??                      setConvertedVideoUrls(new Map())
                      handleConvertAllImagesToVideos()
                    }}
                    disabled={isConvertingToVideo.size > 0}
                    className="flex-1 bg-gradient-to-r from-orange-500 via-red-500 to-orange-500 hover:from-orange-400 hover:via-red-400 hover:to-orange-400 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/50 hover:shadow-xl hover:shadow-orange-500/50 transition-all duration-300"
                    size="lg"
                  >
                    {isConvertingToVideo.size > 0 ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        AIê°€ ?ìƒ???ì„±?˜ê³  ?ˆìŠµ?ˆë‹¤...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-5 h-5 mr-2" />
                        ?ìƒ ?¬ìƒ??                      </>
                    )}
                  </Button>
                ) : (
                  // ?ìƒ???†ê±°???¼ë?ë§??ì„±??ê²½ìš°: ?ìƒ ?ì„± ë²„íŠ¼
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
                          <>ê°œë³„ ?ìƒ ?ì„± ì¤?({convertedVideoUrls.size}/3)</>
                        ) : (
                          <>AIê°€ ?ìƒ???ì„±?˜ê³  ?ˆìŠµ?ˆë‹¤...</>
                        )}
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5 mr-2" />
                        {convertedVideoUrls.size > 0 ? (
                          <>?ìƒ ?¬ìƒ??({convertedVideoUrls.size}/3 ?„ë£Œ)</>
                        ) : (
                          <>?ìƒ ?ì„±</>
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
                ?¸ë„¤???ì„±
              </h2>
              <p className="text-slate-600 text-base">?¼ì¸  ?¸ë„¤?¼ì„ ?ì„±?˜ì„¸??/p>
            </div>

            {/* ?ì„± ë°©ì‹ ? íƒ */}
            <Card className="border border-purple-200 rounded-2xl shadow-lg bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-purple-600" />
                  ?¸ë„¤???ì„± ë°©ì‹
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
                    AI ?ì„±
                  </Button>
                  <Button
                    onClick={() => setThumbnailMode("manual")}
                    variant={thumbnailMode === "manual" ? "default" : "outline"}
                    className={`flex-1 ${thumbnailMode === "manual" ? "bg-purple-500 hover:bg-purple-600 text-white" : ""}`}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    ì§ì ‘ ?ì„±
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* AI ?ì„± ëª¨ë“œ */}
            {thumbnailMode === "ai" && (
              <Card className="border border-purple-200 rounded-2xl shadow-lg bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    AI ?¸ë„¤???ì„±
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-center items-start">
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-center text-gray-600">?¸ë„¤??ë¯¸ë¦¬ë³´ê¸°</h3>
                      <div className="relative" style={{ width: "300px", height: "533px" }}>
                        {thumbnailUrl ? (
                          <canvas
                            ref={thumbnailCanvasRef}
                            className="w-full h-full border-2 border-gray-300 rounded-lg"
                            style={{ aspectRatio: "9/16" }}
                          />
                        ) : (
                          <div className="w-full h-full border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                            <span className="text-gray-400 text-sm">?¸ë„¤???ì„± ë²„íŠ¼???ŒëŸ¬ì£¼ì„¸??/span>
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
                              ?ì„± ì¤?..
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              AI ?¸ë„¤???ì„±
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

            {/* ì§ì ‘ ?ì„± ëª¨ë“œ */}
            {thumbnailMode === "manual" && (
              <Card className="border border-purple-200 rounded-2xl shadow-lg bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-purple-600" />
                    ì§ì ‘ ?¸ë„¤???ì„±
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* ?¼ìª½: ?´ë?ì§€ ? íƒ ë°??ìŠ¤???…ë ¥ */}
                    <div className="space-y-4">
                      {/* ?´ë?ì§€ ? íƒ */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-slate-700">?´ë?ì§€ ? íƒ</Label>
                        
                        {/* ?´ë?ì§€ ?…ë¡œ??*/}
                        <div className="space-y-2">
                          <Label className="text-xs text-slate-500">?´ë?ì§€ ?Œì¼ ?…ë¡œ??/Label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleCustomThumbnailUpload}
                            className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-purple-500 file:to-pink-500 file:text-white hover:file:from-purple-400 hover:file:to-pink-400 file:cursor-pointer bg-white/80 border border-slate-200 rounded-lg p-2 shadow-sm"
                          />
                        </div>

                        {/* ?ì„±???´ë?ì§€?ì„œ ? íƒ */}
                        {imageUrls.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-xs text-slate-500">?´ë?ì§€ ?ì„± ?¨ê³„?ì„œ ?ì„±???´ë?ì§€ ? íƒ</Label>
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
                                    alt={`?ì„±???´ë?ì§€ ${index + 1}`}
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

                      {/* ?ìŠ¤???…ë ¥ */}
                      {customThumbnailImage && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-slate-700">ì²?ë²ˆì§¸ ì¤??ìŠ¤??/Label>
                            <Input
                              value={customThumbnailText.line1}
                              onChange={(e) => setCustomThumbnailText({ ...customThumbnailText, line1: e.target.value })}
                              placeholder="ì²?ë²ˆì§¸ ì¤??ìŠ¤???…ë ¥"
                              className="bg-white/80 border-slate-200"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-slate-700">??ë²ˆì§¸ ì¤??ìŠ¤??/Label>
                            <Input
                              value={customThumbnailText.line2}
                              onChange={(e) => setCustomThumbnailText({ ...customThumbnailText, line2: e.target.value })}
                              placeholder="??ë²ˆì§¸ ì¤??ìŠ¤???…ë ¥"
                              className="bg-white/80 border-slate-200"
                            />
                          </div>

                          {/* ?ìŠ¤???¤í????¤ì • */}
                          <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <Label className="text-sm font-semibold text-slate-700">?ìŠ¤???¤í????¤ì •</Label>
                            
                            {/* ì²?ë²ˆì§¸ ì¤??‰ìƒ */}
                            <div className="space-y-2">
                              <Label className="text-xs text-slate-600">ì²?ë²ˆì§¸ ì¤??‰ìƒ</Label>
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

                            {/* ??ë²ˆì§¸ ì¤??‰ìƒ */}
                            <div className="space-y-2">
                              <Label className="text-xs text-slate-600">??ë²ˆì§¸ ì¤??‰ìƒ</Label>
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

                            {/* ê¸€???¬ê¸° */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-slate-600">ê¸€???¬ê¸°</Label>
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

                            {/* ?ìŠ¤???„ì¹˜ */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-slate-600">?ìŠ¤???„ì¹˜</Label>
                                <span className="text-xs text-slate-500">
                                  {Math.round(customThumbnailTextStyle.position * 100)}% (?ë‹¨: 0%, ?˜ë‹¨: 100%)
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

                            {/* ?Œë‘ë¦??¤ì • */}
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs text-slate-600">?Œë‘ë¦??ê»˜</Label>
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
                                  <Label className="text-xs text-slate-600">?Œë‘ë¦??‰ìƒ</Label>
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

                            {/* ?´ë?ì§€ ?•ë?/ì¶•ì†Œ */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-slate-600">?´ë?ì§€ ?¬ê¸°</Label>
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

                            {/* ?ìŠ¤???Œì „ */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-slate-600">?ìŠ¤???Œì „</Label>
                                <span className="text-xs text-slate-500">
                                  {customThumbnailTextStyle.textRotation}Â° (-180Â° ~ 180Â°)
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
                            ?¸ë„¤???€??                          </Button>
                        </div>
                      )}
                    </div>

                    {/* ?¤ë¥¸ìª? ë¯¸ë¦¬ë³´ê¸° */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-700">ë¯¸ë¦¬ë³´ê¸°</Label>
                      <div className="relative" style={{ width: "300px", height: "533px" }}>
                        {customThumbnailImage ? (
                          <canvas
                            ref={thumbnailCanvasRef}
                            className="w-full h-full border-2 border-gray-300 rounded-lg"
                            style={{ aspectRatio: "9/16" }}
                          />
                        ) : (
                          <div className="w-full h-full border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                            <span className="text-gray-400 text-sm">?´ë?ì§€ë¥??…ë¡œ?œí•´ì£¼ì„¸??/span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ?ì„±???¸ë„¤??ëª©ë¡ */}
            {thumbnailImages.length > 0 && (
              <Card className="border border-purple-200 rounded-2xl shadow-lg bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-purple-600" />
                    ?ì„±???¸ë„¤??ëª©ë¡ ({thumbnailImages.length}ê°?
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
                          alt={`?¸ë„¤??${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {selectedThumbnailIndex === index && (
                          <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-purple-600" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2">
                          {thumb.isCustom ? "ì§ì ‘ ?ì„±" : "AI ?ì„±"}
                        </div>
                      </div>
                    ))}
                  </div>
                  {selectedThumbnailIndex >= 0 && (
                    <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-sm text-purple-700">
                        ? íƒ???¸ë„¤?? {selectedThumbnailIndex + 1}ë²?({thumbnailImages[selectedThumbnailIndex]?.isCustom ? "ì§ì ‘ ?ì„±" : "AI ?ì„±"})
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ?¤ë¹„ê²Œì´??ë²„íŠ¼ */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setActiveStep("render")}
                className="flex-1 border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 hover:from-orange-100 hover:to-amber-100 hover:text-orange-800 hover:border-orange-400 font-semibold shadow-md transition-all"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                ?´ì „
              </Button>
              <Button
                onClick={() => setActiveStep("preview")}
                disabled={selectedThumbnailIndex === -1 || !thumbnailUrl}
                className="flex-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 hover:from-purple-400 hover:via-pink-400 hover:to-purple-400 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/50 transition-all duration-300"
                size="lg"
              >
                ?¤ìŒ
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
    <div className="animal-shopping-dark relative min-h-screen overflow-hidden text-[#fff6ee]">
      {/* Cute pet studio atmosphere */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-28 top-[-80px] h-[520px] w-[520px] rounded-full bg-[#7dd3a8]/18 blur-[130px]" />
        <div className="absolute -right-24 bottom-[-60px] h-[540px] w-[540px] rounded-full bg-[#ff8fab]/16 blur-[140px]" />
        <div className="absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-[#ffc4a8]/10 blur-[110px]" />
        <div
          className="absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 28%, rgba(255,246,238,.7) 1.4px, transparent 1.4px), radial-gradient(circle at 72% 58%, rgba(125,211,168,.55) 1.6px, transparent 1.6px)",
            backgroundSize: "44px 44px, 68px 68px",
          }}
        />
        <PawPrint className="animal-float absolute left-[8%] top-[18%] h-8 w-8 text-[#7dd3a8]/25" />
        <PawPrint className="animal-float absolute right-[12%] top-[28%] h-10 w-10 text-[#ff8fab]/22" style={{ animationDelay: "0.8s" }} />
        <PawPrint className="animal-sparkle absolute left-[22%] bottom-[16%] h-7 w-7 text-[#ffc4a8]/28" style={{ animationDelay: "1.2s" }} />
      </div>

      {/* Sticky studio bar (work mode) */}
      {!showProjectList ? (
        <header className="sticky top-0 z-50 border-b border-[rgba(255,246,238,0.1)] bg-[#101c1a]/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">
            <div className="flex min-w-0 items-center gap-2 md:gap-3">
              <Link href="/WingsAIStudioShotForm">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full border border-[rgba(255,246,238,0.12)] bg-white/[0.04] text-[#a8bdb4] hover:bg-white/[0.08] hover:text-[#fff6ee]"
                >
                  <Home className="mr-2 h-4 w-4" />
                  ??                </Button>
              </Link>
              <button
                type="button"
                onClick={() => setShowProjectList(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,246,238,0.12)] bg-white/[0.04] px-3 py-1.5 text-sm text-[#a8bdb4] transition hover:border-[#7dd3a8]/4 hover:text-[#fff6ee]"
              >
                <FolderOpen className="h-4 w-4" />
                ëª©ë¡
              </button>
              {currentProject ? (
                <div className="min-w-0">
                  <p className="animal-display truncate text-sm font-semibold text-[#fff6ee]">
                    {currentProject.name}
                  </p>
                  <p className="text-[10px] font-extrabold tracking-[0.14em] text-[#7dd3a8]">
                    ?¾ PET STUDIO Â· {animalCharacter.name}
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
                    ?€??ì¤?                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    ?€??                  </>
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
                  className="rounded-full border border-[rgba(255,246,238,0.12)] bg-white/[0.04] text-[#a8bdb4] hover:bg-white/[0.08] hover:text-[#fff6ee]"
                >
                  <Home className="mr-2 h-4 w-4" />
                  ?ˆìœ¼ë¡?                </Button>
              </Link>
            </div>

            <div className="animal-stage-hero relative overflow-hidden rounded-[36px] border border-[rgba(255,246,238,0.14)] bg-[#1a2a26]/95 shadow-2xl shadow-black/35">
              <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-[#7dd3a8]/18 via-[#ff8fab]/08 to-transparent" />
              <div className="absolute -right-10 top-6 h-48 w-48 rounded-full bg-[#ff8fab]/20 blur-[70px]" />
              <div className="absolute -left-8 bottom-0 h-40 w-40 rounded-full bg-[#7dd3a8]/18 blur-[60px]" />
              <div className="relative grid gap-8 p-7 md:p-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
                <div>
                  <p className="animal-display text-3xl font-bold text-[#fff6ee] md:text-4xl">
                    AI ?™ë¬¼ ?¼í•‘ ?í¼
                  </p>
                  <div className="animal-bubble-chip mt-4 inline-flex items-center gap-2 px-3 py-1.5 text-[10px]">
                    <PawPrint className="animal-wiggle h-3.5 w-3.5" />
                    PET CHARACTER STUDIO
                  </div>
                  <h1 className="animal-display mt-4 text-4xl font-bold leading-[1.15] text-[#fff6ee] md:text-5xl lg:text-[3.4rem]">
                    ê·€?¬ìš´ ì¹œêµ¬ê°€
                    <br />
                    <span className="bg-gradient-to-r from-[#7dd3a8] via-[#ffc4a8] to-[#ff8fab] bg-clip-text text-transparent">
                      ?¥ì„ ë³´ëŸ¬ ê°€??
                    </span>
                  </h1>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-[#a8bdb4]">
                    ìºë¦­?°ë? ê³ ë¥´ê³? ë§ˆíŠ¸?ì„œ ?œí’ˆ??ì§‘ëŠ” 9:16 ë°”ì´???í¼??                    ë§ë‘ë§ë‘?????¤íŠœ?”ì˜¤?ì„œ ë§Œë“¤??ë³´ì„¸??
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
                      ??ì´¬ì˜ ?œì‘
                    </Button>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-[28px] border border-[rgba(255,246,238,0.14)] bg-gradient-to-br from-[#7dd3a8]/10 via-black/20 to-[#ff8fab]/10 p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[10px] font-extrabold tracking-[0.16em] text-[#7dd3a8]">
                      CUTE PIPELINE
                    </p>
                    <span className="animal-sparkle text-lg">??/span>
                  </div>
                  <div className="space-y-3">
                    {[
                      ["?±", "ìºë¦­??, "ê·€?¬ìš´ ?¼í¼ ë§Œë“¤ê¸?],
                      ["?›’", "?œì—°", "?œí’ˆ ì§‘ê³  ë°˜ì‘?˜ê¸°"],
                      ["?¬", "?í¼", "9:16?¼ë¡œ ?´ë³´?´ê¸°"],
                    ].map(([emoji, title, desc], index) => (
                      <div
                        key={title}
                        className="flex items-center gap-3 rounded-[20px] border border-[rgba(255,246,238,0.1)] bg-[#101c1a]/55 px-3 py-3"
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7dd3a8]/15 text-xl">
                          {emoji}
                        </span>
                        <div className="min-w-0">
                          <p className="animal-display text-sm font-semibold text-[#fff6ee]">
                            {String(index + 1).padStart(2, "0")} Â· {title}
                          </p>
                          <p className="text-xs text-[#a8bdb4]">{desc}</p>
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
            <div className="mb-4 flex flex-wrap items-center justify-center gap-2 rounded-xl border-2 border-[#8fbc8f]/40 bg-[#8fbc8f]/15 p-4">
              <Factory className="h-5 w-5 text-[#8fbc8f]" />
              <span className="font-semibold text-[#f3ebe0]">?ë™??ëª¨ë“œ ?ë™ ?ì„±:</span>
              <span className="text-[#8fbc8f]">{factoryAutoRunItem.productName}</span>
              <span className="text-sm text-[#9aa89c]">
                Â· ?„ë£Œ ?¨ê³„?ì„œ ?Œê³µ???ˆì•½ ?„ë£Œ?ë? ?„ë¥´ë©??ë™??ëª¨ë“œ ëª©ë¡???€?¥ë©?ˆë‹¤.
              </span>
            </div>
          )}

        {/* ?ˆì•½ ë°œí–‰ ëª©ë¡: ?ë™??ëª¨ë“œ ë¹„í™œ??*/}
        {false && showProjectList && showFactoryView && (
          <Card className="mb-6 border-[#8fbc8f]/25 bg-[#8fbc8f]/[0.06]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-[#8fbc8f]" />
                ?ˆì•½ ë°œí–‰ ëª©ë¡
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                ì§€?•í•œ ? ì§œ???ìƒ???¤ìš´ë¡œë“œ?????ˆìŠµ?ˆë‹¤. ?„ë£Œ ?¨ê³„?ì„œ ?Œì˜ˆ??ë°œí–‰?ìœ¼ë¡??±ë¡?˜ì„¸??
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {scheduledItems.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[rgba(243,235,224,0.14)] py-4 text-center text-sm text-muted-foreground">
                  ?ˆì•½???ìƒ???†ìŠµ?ˆë‹¤. ?ìƒ ?œì‘ ??<strong>?„ë£Œ</strong> ?¨ê³„?ì„œ ?Œì˜ˆ??ë°œí–‰??ë²„íŠ¼???ŒëŸ¬ ?±ë¡?˜ì„¸??
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
                              ?¤ìš´ë¡œë“œ
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
            <div className="rounded-[32px] border border-[rgba(255,246,238,0.12)] bg-[#1a2a26]/90 p-3 shadow-2xl shadow-black/25 md:p-4">
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="animal-bubble-chip px-3 py-1 text-[10px]">?¾ CUTE STEPS</p>
                <p className="text-[11px] font-semibold text-[#a8bdb4]">ë°œìêµ?„ ?°ë¼ê°€ ë³¼ê¹Œ??</p>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
                {[
                  { step: "product", label: "ìºë¦­?°Â·ì œ??, emoji: "?±" },
                  { step: "script", label: "?€ë³¸Â·TTS", emoji: "?’¬" },
                  { step: "video", label: "?´ë?ì§€", emoji: "?–¼ï¸? },
                  { step: "render", label: "?ìƒ", emoji: "?¥" },
                  { step: "thumbnail", label: "?¸ë„¤??, emoji: "?? },
                  { step: "preview", label: "?¸ì§‘Â·?„ë£Œ", emoji: "?‚ï¸" },
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
                          ? "border-[#ff8fab]/50 bg-[#ff8fab]/15 shadow-lg shadow-[#ff8fab]/20"
                          : isCompleted
                            ? "border-[#7dd3a8]/35 bg-[#7dd3a8]/12"
                            : "border-[rgba(255,246,238,0.08)] bg-black/20 hover:border-[#7dd3a8]/3 hover:bg-white/[0.04]"
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
                            ? "animal-paw-active border-[#ff8fab]/45 bg-[#ff8fab] text-white"
                            : isCompleted
                              ? "border-[#7dd3a8]/40 bg-[#7dd3a8]/20"
                              : "border-[rgba(255,246,238,0.12)] bg-white/[0.04]"
                        }`}
                      >
                        {isCompleted && !isActive ? (
                          <CheckCircle2 className="h-5 w-5 text-[#7dd3a8]" />
                        ) : (
                          <span>{item.emoji}</span>
                        )}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={`text-[9px] font-extrabold tracking-[0.12em] ${
                            isActive
                              ? "text-[#ff8fab]"
                              : isCompleted
                                ? "text-[#7dd3a8]"
                                : "text-[#5f746b]"
                          }`}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </p>
                        <p
                          className={`animal-display mt-0.5 line-clamp-2 text-[11px] font-semibold leading-tight ${
                            isActive
                              ? "text-[#fff6ee]"
                              : isCompleted
                                ? "text-[#e8f5ee]"
                                : "text-[#a8bdb4]"
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

        {/* ë©”ì¸ ì»¨í…ì¸?*/}
        {showProjectList ? (
          <div className="space-y-6">
            {/* ?„ë¡œ?íŠ¸ ëª©ë¡ */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="animal-display text-lg font-bold text-[#fff6ee]">?„ë¡œ?íŠ¸ ëª©ë¡</p>
                <p className="mt-1 text-sm text-[#a8bdb4]">?¼í•‘ ?í¼ ?„ë¡œ?íŠ¸ë¥?ê´€ë¦¬í•˜?¸ìš”</p>
              </div>
              <Button
                onClick={() => {
                  setShowCreateProjectDialog(true)
                  setNewProjectName("")
                  setNewProjectDescription("")
                }}
                className="bg-[#c45c3e] font-semibold text-white shadow-lg shadow-[#c45c3e]/30 hover:bg-[#b04f34]"
              >
                <Plus className="w-4 h-4 mr-2" />
                ??ì´¬ì˜ ?œì‘
              </Button>
            </div>

            {/* ?ë™??ëª¨ë“œ UI ì§„ì…???œê±° ???„ë¡œ?íŠ¸ ëª©ë¡ë§??œì‹œ */}
            {true ? (
            <>
            {/* ?„ë¡œ?íŠ¸ ê²€??*/}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 z-10" />
              <Input
                placeholder="?„ë¡œ?íŠ¸ ê²€??.."
                value={projectSearchQuery}
                onChange={(e) => setProjectSearchQuery(e.target.value)}
                className="h-12 border-[rgba(243,235,224,0.12)] bg-[#121a16]/90 pl-12 text-[#f3ebe0] shadow-xl shadow-black/20 placeholder:text-[#5c6b5f] focus:border-[#8fbc8f] focus:ring-[#8fbc8f]/20"
              />
            </div>

            {/* ?„ë¡œ?íŠ¸ ëª©ë¡ */}
            {isLoadingProjects ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#8fbc8f]" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {projects
                  .filter((project) =>
                    project.name.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                    project.description?.toLowerCase().includes(projectSearchQuery.toLowerCase())
                  )
                  .map((project, index) => {
                    // ê°€??ìµœê·¼???€?¥í•œ ?„ë¡œ?íŠ¸ ?˜ë‚˜ë§?'ìµœê·¼' ?œê·¸ ?œì‹œ (?•ë ¬??ëª©ë¡??ì²?ë²ˆì§¸)
                    const isRecent = index === 0
                    
                    return (
                    <Card 
                      key={project.id} 
                      className={`${isRecent ? "border-2 border-[#c45c3e]" : "border border-[rgba(243,235,224,0.12)]"} group relative overflow-hidden transition-all duration-300 hover:border-[#8fbc8f]/45 hover:shadow-[0_20px_50px_rgba(0,0,0,0.35)]`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-[#8fbc8f]/[0.06] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                      {isRecent && (
                        <div className="absolute top-1 right-2 z-20">
                          <span className="rounded-full border border-[#c45c3e]/40 bg-[#c45c3e] px-2 py-1 text-xs font-bold text-white shadow-lg">
                            ìµœê·¼
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
                                        alert("?„ë¡œ?íŠ¸ ?´ë¦„ ë³€ê²½ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤.")
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
                            <span className="text-slate-500">?ì„±</span>
                            <span className="text-slate-600 font-medium">{new Date(project.created_at).toLocaleDateString("ko-KR")}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">?˜ì •</span>
                            <span className="text-slate-600 font-medium">{new Date(project.updated_at).toLocaleDateString("ko-KR")}</span>
                          </div>
                          <Button
                            onClick={() => loadProject(project.id)}
                            className="animal-cta-cute mt-4 w-full rounded-full font-semibold"
                          >
                            <PawPrint className="w-4 h-4 mr-2" />
                            ì´¬ì˜???´ê¸°
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
                  <div className="absolute inset-0 rounded-full bg-[#8fbc8f]/20 blur-2xl" />
                  <div className="relative rounded-full border border-[#8fbc8f]/30 bg-[#8fbc8f]/10 p-6 shadow-lg">
                    <PawPrint className="h-16 w-16 text-[#8fbc8f]" />
                  </div>
                </div>
                <p className="mb-6 text-lg text-[#9aa89c]">?„ì§ ì´¬ì˜???†ì–´?? ê·€?¬ìš´ ì¹œêµ¬ë¥?ë¶ˆëŸ¬ë³¼ê¹Œ??</p>
                <Button
                  onClick={() => {
                    setShowCreateProjectDialog(true)
                    setNewProjectName("")
                    setNewProjectDescription("")
                  }}
                  className="animal-cta-cute rounded-full px-8 py-6 text-lg font-semibold"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  ??ì´¬ì˜ ?œì‘
                </Button>
              </div>
            )}

            {/* ???„ë¡œ?íŠ¸ ?ì„± ?¤ì´?¼ë¡œê·?*/}
            <Dialog open={showCreateProjectDialog} onOpenChange={setShowCreateProjectDialog}>
              <DialogContent className="border-[rgba(243,235,224,0.12)] bg-[#121a16] shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-2xl font-bold text-[#f3ebe0]">
                    <div className="rounded-xl border border-[#8fbc8f]/30 bg-[#8fbc8f]/15 p-2 shadow-sm">
                      <PawPrint className="h-5 w-5 text-[#8fbc8f]" />
                    </div>
                    ??ì´¬ì˜ ?œì‘
                  </DialogTitle>
                  <DialogDescription className="text-[#9aa89c]">
                    ?„ë¡œ?íŠ¸ ?´ë¦„ê³??¤ëª…???…ë ¥??ìºë¦­???¤íŠœ?”ì˜¤ ì´¬ì˜???œì‘?˜ì„¸??
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-5 py-4">
                  <div className="space-y-2">
                    <Label className="font-semibold text-[#d7e0d8]">?„ë¡œ?íŠ¸ ?´ë¦„</Label>
                    <Input
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="?„ë¡œ?íŠ¸ ?´ë¦„???…ë ¥?˜ì„¸??
                      className="border-[rgba(243,235,224,0.12)] bg-black/35 text-[#f3ebe0] placeholder:text-[#6b7a6e] focus:border-[#8fbc8f]/70 focus:ring-[#8fbc8f]/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-semibold text-[#d7e0d8]">?¤ëª… (? íƒ?¬í•­)</Label>
                    <Textarea
                      value={newProjectDescription}
                      onChange={(e) => setNewProjectDescription(e.target.value)}
                      placeholder="?„ë¡œ?íŠ¸ ?¤ëª…???…ë ¥?˜ì„¸??
                      rows={3}
                      className="resize-none border-[rgba(243,235,224,0.12)] bg-black/35 text-[#f3ebe0] placeholder:text-[#6b7a6e] focus:border-[#8fbc8f]/70 focus:ring-[#8fbc8f]/20"
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
                    className="border-[rgba(243,235,224,0.14)] bg-white/[0.03] font-semibold text-[#9aa89c] hover:bg-white/[0.08] hover:text-[#f3ebe0]"
                  >
                    ì·¨ì†Œ
                  </Button>
                  <Button
                    onClick={() => {
                      if (newProjectName.trim()) {
                        saveProject(undefined, true) // ???„ë¡œ?íŠ¸ë¡??ì„± (ê¸°ì¡´ ?„ë¡œ?íŠ¸ ??–´?°ê¸°)
                      } else {
                        alert("?„ë¡œ?íŠ¸ ?´ë¦„???…ë ¥?´ì£¼?¸ìš”.")
                      }
                    }}
                    disabled={isSavingProject}
                    className="bg-[#c45c3e] font-semibold text-white shadow-lg shadow-[#c45c3e]/25 hover:bg-[#b04f34]"
                  >
                    {isSavingProject ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ?ì„± ì¤?..
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        ?ì„±
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            </>
            ) : (
            /* ?ë™??ëª¨ë“œ ë·? ?„ë¦¬ë¯¸ì—„ UI + ?ìƒ ?ë™??? ë‹ˆë©”ì´??*/
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
                {/* ?ë‹¨ ?¤ë” */}
                <div className="rounded-2xl bg-gradient-to-br from-slate-800 via-slate-700 to-amber-900/40 p-6 text-white shadow-xl shadow-slate-900/30 border border-slate-600/50">
                  <p className="text-slate-200 text-base font-medium tracking-tight">
                    ? ì§œÂ·?í’ˆÂ·?´ë?ì§€Â·ëª©ì†Œë¦¬ë? ?•í•´?ë©´ <span className="text-amber-300 font-semibold">?´ë‹¹ ? ì§œ???ìƒ???ë™ ?ì„±</span>?©ë‹ˆ??
                  </p>
                </div>
                {/* ì»¨ë² ?´ì–´ ë²¨íŠ¸: ?ìƒ ?ë™???Œì´?„ë¼??*/}
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
                          <>?‘ì—… ì¤?Â· {currentPhaseLabel}</>
                        ) : (
                          <>?ë™???€ê¸?Â· ?´ë‹¹ ? ì§œ???ë™ ?ì„±</>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                )})()}
                {/* ?ˆì•½ ?¬ë ¥ */}
                <div className="rounded-2xl border border-slate-200/80 bg-white/98 p-4 md:p-5 shadow-md shadow-slate-200/50 backdrop-blur-sm" style={{ animation: "cardEnter 0.5s ease-out both", animationDelay: "100ms" }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-amber-900 flex items-center gap-2">
                    <CalendarClock className="w-5 h-5 text-amber-600" />
                    ?ˆì•½ ?¬ë ¥
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
                  const weekDays = ["??, "??, "??, "??, "ëª?, "ê¸?, "??]
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
                      ? `${dateStr}: ${itemsWithTime.length ? itemsWithTime.join(" Â· ") : "?ˆì•½ " + count + "ê±?}`
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
                        title={titleText ? `${titleText}\n?´ë¦­?˜ë©´ ??? ì§œë¡??ˆì•½ ì¶”ê?` : "?´ë¦­?˜ë©´ ??? ì§œë¡??ˆì•½ ì¶”ê?"}
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
                                <span className="text-[9px] text-amber-600">??{count - 1}ê±?/span>
                              </>
                            )}
                          </div>
                        )}
                        {hasSchedule && productNames.length === 0 && count > 0 && (
                          <span className="text-[10px] text-amber-600 mt-0.5">?ˆì•½ {count}ê±?/span>
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
                  ?ˆì•½???ˆëŠ” ? ì— ?ˆì•½???ìƒ(?í’ˆëª????œì‹œ?©ë‹ˆ?? ? ì§œë¥??´ë¦­?˜ë©´ ?´ë‹¹ ? ì§œë¡??ˆì•½ ì¶”ê??????ˆìŠµ?ˆë‹¤.
                </p>
              </div>
              {/* ?ë™??ëª¨ë“œ 6?¨ê³„ ?„ë¡œ?¸ìŠ¤ ?¤í…Œ??*/}
              {(() => {
                const generatingItem = factoryPipelineRunningItemId
                  ? factorySchedules.find((s) => s.id === factoryPipelineRunningItemId)
                  : factorySchedules.find((s) => s.status === "generating")
                const currentStepIndex = generatingItem ? getFactoryPhaseStepIndex(generatingItem.phase) : -1
                const steps = [
                  { step: "product", label: "?œí’ˆ ?…ë ¥", icon: ShoppingBag },
                  { step: "script", label: "?€ë³?ë°?TTS", icon: FileText },
                  { step: "video", label: "?´ë?ì§€ ?ì„±", icon: ImageIcon },
                  { step: "render", label: "?ìƒ ?ì„±", icon: Video },
                  { step: "thumbnail", label: "?¸ë„¤??, icon: ImageIcon },
                  { step: "preview", label: "?„ë£Œ", icon: CheckCircle2 },
                ] as const
                if (currentStepIndex < 0) return null
                return (
                  <div className="rounded-2xl border border-[rgba(243,235,224,0.12)] bg-[#121a16]/95 p-5 shadow-2xl shadow-black/30 backdrop-blur-sm md:p-6" style={{ animation: "cardEnter 0.5s ease-out both", animationDelay: "200ms" }}>
                    <p className="mb-5 text-center text-sm font-semibold text-[#d7e0d8]">
                      {generatingItem?.productName ? (
                        <span className="text-[#8fbc8f]">ì§„í–‰ ì¤? {generatingItem.productName}</span>
                      ) : (
                        "?ë™ ?ì„± ì§„í–‰ ì¤?
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
                                <div className="absolute inset-0 rounded-full bg-[#8fbc8f]/20 blur-lg" />
                              )}
                              <div
                                className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-500 md:h-12 md:w-12 ${
                                  isActive
                                    ? "scale-110 bg-[#c45c3e] text-white shadow-lg shadow-[#c45c3e]/40 ring-2 ring-[#c45c3e]/40"
                                    : isCompleted
                                      ? "scale-105 border border-[#8fbc8f]/35 bg-[#8fbc8f]/15 text-[#8fbc8f] shadow-md"
                                      : "border border-[rgba(243,235,224,0.1)] bg-white/[0.04] text-[#6b7a6e]"
                                }`}
                              >
                                <Icon className={`h-5 w-5 md:h-6 md:w-6 ${isActive ? "animate-bounce" : ""}`} style={isActive ? { animationDuration: "1s" } : undefined} />
                                {isCompleted && (
                                  <div className="absolute inset-0 flex items-center justify-center rounded-xl">
                                    <CheckCircle2 className="h-6 w-6 text-[#8fbc8f] md:h-7 md:w-7" />
                                  </div>
                                )}
                              </div>
                              <span
                                className={`mt-2 max-w-[3.5rem] text-center text-xs font-medium md:max-w-[4rem] md:text-sm ${
                                  isActive ? "text-[#c45c3e]" : isCompleted ? "text-[#8fbc8f]" : "text-[#9aa89c]"
                                }`}
                              >
                                {item.label}
                              </span>
                              {isActive && (
                                <div className="relative mt-1.5 h-1 w-full animate-pulse rounded-full bg-gradient-to-r from-[#c45c3e] to-[#8fbc8f]" style={{ animationDuration: "1.2s" }} />
                              )}
                            </div>
                            {index < steps.length - 1 && (
                              <div className="mx-0.5 h-0.5 w-3 border-t-2 border-dashed border-[rgba(243,235,224,0.14)] md:w-6" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
              {/* ?ˆì•½ ëª©ë¡ (? ì§œ?? */}
              <div className="grid gap-4">
                {factorySchedules.length === 0 ? (
                  <div className="text-center py-14 rounded-2xl border-2 border-dashed border-slate-200 bg-gradient-to-b from-slate-50 to-white animate-in fade-in duration-500">
                    <Factory className="w-14 h-14 mx-auto text-slate-400 mb-4 opacity-80" />
                    <p className="text-slate-600 font-semibold">?ˆì•½???†ìŠµ?ˆë‹¤</p>
                    <p className="text-sm text-slate-500 mt-1.5">?Œì˜ˆ??ì¶”ê??ë¡œ ? ì§œÂ·?í’ˆÂ·?´ë?ì§€Â·ëª©ì†Œë¦¬ë? ?•í•´?ì„¸??</p>
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
                              title="?ˆì•½ ?? œ"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (!confirm(`"${item.productName}" ?ˆì•½???? œ? ê¹Œ??`)) return
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
                                    ?‘ì—… ì¤?Â· {getFactoryPhaseDisplayText(item.phase)}
                                  </p>
                                )}
                                {item.status === "generating" && factoryPipelineQueue.some((q) => q.id === item.id) && item.id !== factoryPipelineRunningItemId && (
                                  <p className="text-sm font-medium text-slate-500 mt-1">
                                    ?€ê¸°ì¤‘
                                  </p>
                                )}
                                <p className="text-sm text-slate-500 mt-0.5">
                                  ë°œí–‰: {new Date(item.scheduledDate + "T" + (item.scheduledTime || "00:00")).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })} {item.scheduledTime || "00:00"}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">ëª©ì†Œë¦? {item.voiceId.replace("ttsmaker-", "").replace("supertone-", "?˜í¼??").replace("elevenlabs-", "ElevenLabs ")}</p>
                                <p className="text-xs text-amber-600 mt-1">?´ë¦­?˜ë©´ ?˜ë™ ?¸ì§‘</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isReady && item.youtubeUploaded && (
                                <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                                  ? íŠœë¸??…ë¡œ???„ë£Œ
                                </span>
                              )}
                              {isReady && !item.youtubeUploaded && youtubeChannelName && (
                                <>
                                  <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                                    ? íŠœë¸?ë¯¸ì—…ë¡œë“œ
                                  </span>
                                  <Button
                                    size="sm"
                                    className="bg-[#ff0000] hover:bg-[#cc0000] text-white"
                                    disabled={uploadingFactoryId === item.id}
                                    onClick={async () => {
                                      const blob = await getShotFormScheduleVideoBlob(item.videoBlobId || item.id)
                                      if (!blob) {
                                        alert("?€?¥ëœ ?ìƒ??ì°¾ì„ ???†ìŠµ?ˆë‹¤. ?´ë‹¹ ?ˆì•½???´ë¦­???¤ì‹œ ?ìƒ???ì„±??ì£¼ì„¸??")
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
                                          alert(data.message || "? íŠœë¸??ˆì•½ ?…ë¡œ?œê? ?„ë£Œ?˜ì—ˆ?µë‹ˆ??")
                                        } else {
                                          alert(`? íŠœë¸??…ë¡œ???¤íŒ¨: ${data.error || res.statusText}`)
                                        }
                                      } catch (e) {
                                        alert(`?…ë¡œ??ì¤??¤ë¥˜: ${e instanceof Error ? e.message : "?????†ìŒ"}`)
                                      } finally {
                                        setUploadingFactoryId(null)
                                      }
                                    }}
                                  >
                                    {uploadingFactoryId === item.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                                    ? íŠœë¸Œì— ?…ë¡œ??                                  </Button>
                                </>
                              )}
                              {isReady && !item.youtubeUploaded && !youtubeChannelName && (
                                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                  ?ˆì•½ ?„ë£Œ
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
                                  {isGenerating ? "?ì„± ì¤?.." : "?ìƒ ?ì„±"}
                                </Button>
                              )}
                              {item.status === "failed" && (
                                <span className="text-xs text-red-600" title={item.errorMessage || ""}>
                                  ?¤íŒ¨{item.errorMessage ? `: ${item.errorMessage}` : ""}
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
            {/* ?ë™??ëª¨ë“œ ë¹„ë?ë²ˆí˜¸ ?…ë ¥ (?«ì ë§ˆìŠ¤?? */}
            <Dialog open={showFactoryPasswordDialog} onOpenChange={(open) => { setShowFactoryPasswordDialog(open); if (!open) setFactoryPasswordInput("") }}>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    ?ë™??ëª¨ë“œ
                    <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">?ŒìŠ¤??/span>
                  </DialogTitle>
                  <DialogDescription>ë¹„ë?ë²ˆí˜¸ë¥??…ë ¥?˜ì„¸??</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="factory-pw" className="text-sm text-slate-600">ë¹„ë?ë²ˆí˜¸</Label>
                    <Input
                      id="factory-pw"
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="ë¹„ë?ë²ˆí˜¸"
                      value={factoryPasswordInput}
                      onChange={(e) => setFactoryPasswordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (factoryPasswordInput === "111") {
                            setShowFactoryView(true)
                            setShowFactoryPasswordDialog(false)
                            setFactoryPasswordInput("")
                          } else {
                            alert("ë¹„ë?ë²ˆí˜¸ê°€ ?¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤.")
                          }
                        }
                      }}
                      className="font-mono"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => { setShowFactoryPasswordDialog(false); setFactoryPasswordInput("") }}>ì·¨ì†Œ</Button>
                    <Button
                      className="bg-amber-600 hover:bg-amber-700"
                      onClick={() => {
                        if (factoryPasswordInput === "111") {
                          setShowFactoryView(true)
                          setShowFactoryPasswordDialog(false)
                          setFactoryPasswordInput("")
                        } else {
                          alert("ë¹„ë?ë²ˆí˜¸ê°€ ?¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤.")
                        }
                      }}
                    >
                      ?•ì¸
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            {/* ?ë™??ëª¨ë“œ ?¤ì • ?¤ì´?¼ë¡œê·?(? íŠœë¸??°ë™) */}
            <Dialog open={showFactorySettingsDialog} onOpenChange={setShowFactorySettingsDialog}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>?ë™??ëª¨ë“œ ?¤ì •</DialogTitle>
                  <DialogDescription>
                    ?ˆì•½ ë°œí–‰ ??? íŠœë¸??¼ì¸  ?ë™ ?…ë¡œ?œë? ?„í•´ ì±„ë„???°ë™?????ˆìŠµ?ˆë‹¤.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label className="text-amber-900 font-medium">YouTube API ?¤ì •</Label>
                    <p className="text-sm text-slate-600">Google Cloud Console?ì„œ OAuth 2.0 ?´ë¼?´ì–¸??ID(??? í”Œë¦¬ì??´ì…˜)ë¥?ë§Œë“  ???„ë˜???…ë ¥?˜ì„¸??</p>
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
                      <strong>redirect_uri_mismatch ?¤ë¥˜ ??</strong> Google Cloud Console ???¬ìš©???¸ì¦ ?•ë³´ ???´ë‹¹ OAuth ?´ë¼?´ì–¸????&quot;?¹ì¸??ë¦¬ë””?‰ì…˜ URI&quot;???„ë˜ ì£¼ì†Œë¥?<strong>ê·¸ë?ë¡?/strong> ì¶”ê??˜ì„¸??
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-slate-100 px-2 py-1 rounded break-all flex-1">
                        {typeof window !== "undefined" ? `${window.location.origin}/api/youtube/callback` : "https://?„ë©”??api/youtube/callback"}
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
                            alert("ë¦¬ë””?‰ì…˜ URIê°€ ?´ë¦½ë³´ë“œ??ë³µì‚¬?˜ì—ˆ?µë‹ˆ??")
                          }
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-amber-900 font-medium">YouTube ?°ë™</Label>
                    {youtubeChannelName ? (
                      <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
                        <p className="text-sm text-amber-800">
                          ?°ê²°??ì±„ë„: <span className="font-semibold">{youtubeChannelName}</span>
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
                          ?°ë™ ?´ì œ
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <p className="text-sm text-slate-600">YouTube ì±„ë„ê³??°ë™?˜ë©´ ?ˆì•½ ë°œí–‰ ???´ë‹¹ ì±„ë„???ë™ ?…ë¡œ?œí•  ???ˆìŠµ?ˆë‹¤.</p>
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
                                  alert(data.error || "?°ë™ ?œì‘???¤íŒ¨?ˆìŠµ?ˆë‹¤.")
                                  return
                                }
                              } catch (e) {
                                alert("?°ë™ ?”ì²­ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.")
                                return
                              }
                            }
                            window.location.href = "/api/youtube/auth?state=shopping_factory"
                          }}
                        >
                          YouTube ì±„ë„ê³??°ë™
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            {/* ?ë™??ëª¨ë“œ - ?ˆì•½ ì¶”ê? ?¤ì´?¼ë¡œê·?(ê³µì¥ ??—?œë„ ?´ë¦¬?„ë¡ showProjectList??????ƒ ?Œë”) */}
            <Dialog open={showAddFactoryScheduleDialog} onOpenChange={setShowAddFactoryScheduleDialog}>
              <DialogContent className="sm:max-w-lg rounded-2xl border-slate-200/80 shadow-xl shadow-slate-200/50 overflow-hidden p-0 gap-0">
                <div className="bg-gradient-to-br from-amber-50 via-white to-orange-50/30 px-6 pt-6 pb-5 border-b border-amber-100/80">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                        <CalendarPlus className="w-5 h-5" />
                      </span>
                      ?ˆì•½ ì¶”ê?
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 text-sm mt-1.5">
                      ë°œí–‰?¼Â·ìƒ???•ë³´ë¥??…ë ¥?˜ë©´ ?´ë‹¹ ? ì§œ???ìƒ???ë™ ?ì„±?©ë‹ˆ??
                    </DialogDescription>
                  </DialogHeader>
                </div>
                <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-700/90">? ì§œ Â· ?œê°„</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-slate-700">ë°œí–‰??/Label>
                        <Input type="date" value={newFactoryDate} onChange={(e) => setNewFactoryDate(e.target.value)} className="rounded-xl border-slate-200 bg-white" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-slate-700">ë°œí–‰ ?œê°„</Label>
                        <Input type="time" value={newFactoryTime} onChange={(e) => setNewFactoryTime(e.target.value)} className="rounded-xl border-slate-200 bg-white" />
                      </div>
                    </div>
                  </div>
                  <div className="h-px bg-gradient-to-r from-transparent via-amber-200/60 to-transparent" />
                  <div className="space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-700/90">?í’ˆ ?•ë³´</p>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700">?í’ˆëª?/Label>
                      <Input placeholder="?í’ˆëª…ì„ ?…ë ¥?˜ì„¸?? value={newFactoryName} onChange={(e) => setNewFactoryName(e.target.value)} className="rounded-xl border-slate-200 bg-white placeholder:text-slate-400" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700">?í’ˆ ?¤ëª… <span className="font-normal text-slate-400">(? íƒ)</span></Label>
                      <Textarea placeholder="?í’ˆ???€??ê°„ë‹¨???¤ëª…" value={newFactoryDesc} onChange={(e) => setNewFactoryDesc(e.target.value)} rows={2} className="resize-none rounded-xl border-slate-200 bg-white placeholder:text-slate-400" />
                    </div>
                  </div>
                  <div className="h-px bg-gradient-to-r from-transparent via-amber-200/60 to-transparent" />
                  <div className="space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-700/90">ë¯¸ë””??Â· ëª©ì†Œë¦?/p>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700">?í’ˆ ?´ë?ì§€</Label>
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
                            <Button type="button" variant="ghost" size="icon" onClick={() => setNewFactoryImage(null)} className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-slate-700 text-white hover:bg-red-500 shadow-md">
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700">ëª©ì†Œë¦?/Label>
                      <Select value={newFactoryVoiceId} onValueChange={setNewFactoryVoiceId}>
                        <SelectTrigger className="rounded-xl border-slate-200 bg-white">
                          <SelectValue placeholder="ëª©ì†Œë¦?? íƒ" />
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
                              ?˜í¼??{v.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {supertoneVoices.length === 0 && (
                        <p className="text-xs text-slate-400">?˜í¼??ëª©ë¡?€ ?€ë³??¨ê³„ AI ?Œì„±?ì„œ ë¶ˆëŸ¬?????ˆì–´??</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-200/80 flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setShowAddFactoryScheduleDialog(false)} className="rounded-xl border-slate-200 text-slate-600 hover:bg-white">
                    ì·¨ì†Œ
                  </Button>
                  <Button
                    onClick={() => {
                      if (!newFactoryDate || !newFactoryName.trim()) {
                        alert("ë°œí–‰?¼ê³¼ ?í’ˆëª…ì„ ?…ë ¥?´ì£¼?¸ìš”.")
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
                      setNewFactoryVoiceId("ttsmaker-?¬ì„±1")
                      setFactoryPipelineQueue((prev) => [...prev, newItem])
                    }}
                    className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium shadow-md shadow-amber-500/25 px-6"
                  >
                    ?ˆì•½ ì¶”ê?
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="animal-step-surface">{renderStepContent()}</div>
        )}
        
        {/* ?¨ê²¨ì§?Canvas (?Œë”ë§ìš©) */}
        <canvas
          ref={canvasRef}
          width={1080}
          height={1920}
          className="hidden"
          style={{ width: "1080px", height: "1920px" }}
        />
      </div>

      {/* ?¤ì´ë²??¸ê¸° ?¤ì›Œ???¤ì´?¼ë¡œê·?*/}
      <Dialog open={showKeywordsDialog} onOpenChange={setShowKeywordsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] bg-white/95 backdrop-blur-xl border-2 border-orange-200/50 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-orange-500" />
              ?„ì¬ ?˜ëœ¨???¤ì›Œ??            </DialogTitle>
            <DialogDescription className="text-slate-600">
              ?¤ì´ë²??°ì´?°ë©?ì„œ ìµœê·¼ 7?¼ê°„ ?¸ê¸° ê²€???¤ì›Œ?œë? ê°€?¸ì™”?µë‹ˆ?? ?¤ì›Œ?œë? ?´ë¦­?˜ë©´ ?œí’ˆëª…ì— ?ë™?¼ë¡œ ?…ë ¥?©ë‹ˆ??
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
            {isLoadingKeywords ? (
              <div className="flex flex-col items-center justify-center py-16">
                {/* AIê°€ ?¤ì›Œ?œë? ì°¾ëŠ” ? ë‹ˆë©”ì´??*/}
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
                    AIê°€ ?¸ê¸° ?¤ì›Œ?œë? ë¶„ì„ ì¤?..
                  </p>
                  <div className="flex items-center justify-center gap-1">
                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                    <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                  </div>
                  <p className="text-sm text-slate-500 mt-4">ìµœì‹  ?¸ë Œ?œë? ì°¾ê³  ?ˆì–´??/p>
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
                        ? íƒ
                      </button>
                      <a
                        href={`https://www.coupang.com/np/search?q=${encodeURIComponent(keyword)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 px-3 py-1.5 text-xs font-semibold bg-white border-2 border-orange-300 hover:border-orange-400 text-orange-600 hover:text-orange-700 rounded-lg transition-all shadow-sm hover:shadow-md text-center"
                      >
                        ì¿ íŒ¡ ê²€??                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-slate-500">?¸ê¸° ?¤ì›Œ?œë? ë¶ˆëŸ¬?????†ìŠµ?ˆë‹¤.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowKeywordsDialog(false)}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
            >
              ?«ê¸°
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ?™ìŠ¤ë´?ì±—ë´‡ */}
      {!isChatbotOpen && (
        <button
          onClick={() => {
            setIsChatbotOpen(true)
            if (chatbotMessages.length === 0) {
              setChatbotMessages([{
                type: "assistant",
                content: "?ˆë…•?˜ì„¸?? ?™ìŠ¤ë´‡ì…?ˆë‹¤. ë¬´ì—‡???„ì??œë¦´ê¹Œìš”?"
              }])
            }
          }}
          className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-50 group"
          title="?™ìŠ¤ë´‡ê³¼ ?€?”í•˜ê¸?
        >
          <Bot className="w-8 h-8 group-hover:scale-110 transition-transform" />
        </button>
      )}

      {isChatbotOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-xl shadow-2xl border-2 border-gray-200 flex flex-col z-50">
          {/* ì±—ë´‡ ?¤ë” */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 rounded-t-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-6 h-6" />
              <h3 className="font-bold text-lg">?™ìŠ¤ë´?/h3>
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

          {/* ë©”ì‹œì§€ ?ì—­ */}
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
                    <span className="text-sm text-gray-500">?‘ë‹µ ?ì„± ì¤?..</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ?…ë ¥ ?ì—­ */}
          <div className="p-4 border-t border-gray-200 bg-white rounded-b-xl">
            <div className="flex gap-2">
              <Textarea
                placeholder="ë©”ì‹œì§€ë¥??…ë ¥?˜ì„¸??.."
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

      {/* ?¤ë””???¼ì´ë¸ŒëŸ¬ë¦??¤ì´?¼ë¡œê·?- ??ƒ ?Œë”ë§?*/}
      {/* BGM ?¼ì´ë¸ŒëŸ¬ë¦??¤ì´?¼ë¡œê·?*/}
      <Dialog open={showBgmLibraryDialog} onOpenChange={(open) => {
        console.log("[Shopping] BGM ?¤ì´?¼ë¡œê·?onOpenChange ?¸ì¶œ??", open, "?„ì¬ ?íƒœ:", showBgmLibraryDialog)
        // ?”ë²„ê¹? ??falseë¡?ë³€ê²½ë˜?”ì? ?•ì¸
        if (!open && showBgmLibraryDialog) {
          console.log("[Shopping] ? ï¸ ?¤ì´?¼ë¡œê·¸ê? ?´ë ¤?ˆëŠ”???«ê¸° ?”ì²­???¤ì–´??")
          console.trace("[Shopping] ?¤íƒ ?¸ë ˆ?´ìŠ¤:")
        }
        setShowBgmLibraryDialog(open)
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>BGM ?¼ì´ë¸ŒëŸ¬ë¦?/DialogTitle>
            <DialogDescription>
              ê´€ë¦¬ìê°€ ?…ë¡œ?œí•œ BGM ì¤‘ì—??? íƒ?˜ì„¸??
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {isLoadingAudioLibrary ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                <span className="ml-2 text-sm text-slate-600">?¼ì´ë¸ŒëŸ¬ë¦?ë¡œë”© ì¤?..</span>
              </div>
            ) : bgmLibrary.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p>?±ë¡??BGM???†ìŠµ?ˆë‹¤.</p>
                <p className="text-xs mt-2">ê´€ë¦¬ì?ê²Œ ë¬¸ì˜?˜ì„¸??</p>
                <p className="text-xs mt-1">ë¡œë“œ??BGM ê°œìˆ˜: {bgmLibrary.length}</p>
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
                    ? íƒ
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ?¨ê³¼???¼ì´ë¸ŒëŸ¬ë¦??¤ì´?¼ë¡œê·?*/}
      <Dialog open={showSfxLibraryDialog} onOpenChange={(open) => {
        console.log("[Shopping] ?¨ê³¼???¤ì´?¼ë¡œê·?onOpenChange ?¸ì¶œ??", open, "?„ì¬ ?íƒœ:", showSfxLibraryDialog)
        // ?”ë²„ê¹? ??falseë¡?ë³€ê²½ë˜?”ì? ?•ì¸
        if (!open && showSfxLibraryDialog) {
          console.log("[Shopping] ? ï¸ ?¤ì´?¼ë¡œê·¸ê? ?´ë ¤?ˆëŠ”???«ê¸° ?”ì²­???¤ì–´??")
          console.trace("[Shopping] ?¤íƒ ?¸ë ˆ?´ìŠ¤:")
        }
        setShowSfxLibraryDialog(open)
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>?¨ê³¼???¼ì´ë¸ŒëŸ¬ë¦?/DialogTitle>
            <DialogDescription>
              ê´€ë¦¬ìê°€ ?…ë¡œ?œí•œ ?¨ê³¼??ì¤‘ì—??? íƒ?˜ì„¸??
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {isLoadingAudioLibrary ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-2 text-sm text-slate-600">?¼ì´ë¸ŒëŸ¬ë¦?ë¡œë”© ì¤?..</span>
              </div>
            ) : sfxLibrary.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p>?±ë¡???¨ê³¼?Œì´ ?†ìŠµ?ˆë‹¤.</p>
                <p className="text-xs mt-2">ê´€ë¦¬ì?ê²Œ ë¬¸ì˜?˜ì„¸??</p>
                <p className="text-xs mt-1">ë¡œë“œ???¨ê³¼??ê°œìˆ˜: {sfxLibrary.length}</p>
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
                    ? íƒ
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ?ˆì•½ ë°œí–‰ ëª¨ë‹¬ (ShotForm ?¼í•‘) */}
      <Dialog open={scheduleModalOpen} onOpenChange={setScheduleModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>?ˆì•½ ë°œí–‰</DialogTitle>
            <DialogDescription>
              ?ìƒ??ë¯¸ë¦¬ ?ì„±???ê³ , ? íƒ??? ì§œÂ·?œê°„???˜ë©´ ?ˆì•½ ëª©ë¡?ì„œ ?¤ìš´ë¡œë“œ?????ˆìŠµ?ˆë‹¤.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="schedule-date">ë°œí–‰ ? ì§œ</Label>
              <Input
                id="schedule-date"
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="schedule-time">ë°œí–‰ ?œê°„</Label>
              <Input
                id="schedule-time"
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </div>
            {productName && (
              <p className="text-sm text-muted-foreground">
                ?œí’ˆ: <span className="font-medium text-foreground">{productName}</span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleModalOpen(false)} disabled={isScheduling}>
              ì·¨ì†Œ
            </Button>
            <Button
              onClick={handleConfirmSchedule}
              disabled={isScheduling || !scheduleDate || !scheduleTime}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isScheduling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ?ìƒ ?ì„± ë°??ˆì•½ ì¤?..
                </>
              ) : (
                <>
                  <CalendarClock className="w-4 h-4 mr-2" />
                  ?ˆì•½?˜ê¸°
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}



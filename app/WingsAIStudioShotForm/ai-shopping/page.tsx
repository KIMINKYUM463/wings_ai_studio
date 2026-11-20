"use client"

import { useState, useRef, useEffect, type PointerEvent as ReactPointerEvent } from "react"
import { promptLikelyShowsPerson } from "@/lib/shotform-person-consistency"
import { sceneClipTime, scenePushInScale } from "@/lib/shotform-scene-motion"
import { startRenderTicker } from "@/lib/shotform-render-ticker"
import { glueKoreanWordUnits } from "@/lib/korean-subtitle-words"
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
  CalendarPlus,
  Mic,
  Film,
  FileJson,
  Package,
  Square,
  BarChart3,
  Menu,
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
import { generateShoppingScript, generateVideoWithSora2, generateImagesWith3Scenes, splitScriptIntoScenes, convertImageToVideoWithWan, convertImagesToVideosWithScript, generateImage, generateImageWithNanobanana, generateVideoWithSeedance, renderProductPhotoMaster, generateShortsThumbnail, generateThumbnailHookingText, generateThumbnailPhraseAndTitles, generateYouTubeMetadata, getNaverTrendingKeywords, analyzeScriptParts, generateImagePromptsFromScript, refineImagePromptWithCustomInput, mergeVideos, generateVideoPromptFromScript, generateVideoPromptFor3Scenes, generateVideoPromptForImage, generatePixabayKeywordSuggestions, searchPixabayImages, searchPixabayVideos, type PixabayImageHit, type PixabayKeywordSuggestion, type PixabayVideoHit, type ShoppingVideoGenerationModel, type ThumbnailPhraseTitleCandidate } from "./actions"
import { voiceLedTargetSeconds } from "@/lib/shorts-master-quality"
import { AiShoppingThumbnailStep } from "./AiShoppingThumbnailStep"
import type { MvpThumbnailDesign } from "@/lib/mvp-thumbnail-design"
import {
  AiShoppingImagesStep,
  type ImageModelId,
  type ImagePromptItem,
  type ScenePixabayState,
} from "./AiShoppingImagesStep"
import { THUMBNAIL_TEMPLATE_STACKS, THUMBNAIL_STYLE_VARIANTS } from "./thumbnail-templates"
import { Checkbox } from "@/components/ui/checkbox"
import { getApiKey } from "@/lib/api-keys"
import { listAiShoppingProjects, createShoppingProject, updateShoppingProject, deleteShoppingProject, getShoppingProject, type ShoppingProject, type ShoppingProjectData, type Ver2ActiveStep, type ProductReviewItem, type StoryboardScene, type SceneTtsTrack, type CoupangReviewInsightsData } from "./project-actions"
import { uploadMediaBlobToStorage, uploadTtsBlobToStorage } from "@/lib/shotform-tts-storage-upload"
import { fetchSupertonicTts } from "@/lib/supertonic-runtime-client"
import { fetchAdamTts } from "@/lib/adam-tts"
import { migrateVer2ActiveStep } from "./ver2-steps"
import { getAudioLibrary, getAllAudioLibrary, type AudioLibraryItem } from "./audio-library-actions"
import { Plus, Trash2, Edit2, Search, FolderOpen, Factory, Cog, ChevronLeft, ChevronRight, Settings, Wand2, ClipboardPaste, ZoomIn, ZoomOut, RotateCcw, Upload, FlaskConical } from "lucide-react"
import { CoupangReviewPanel, parsePastedReviews } from "./CoupangReviewPanel"
import { ScriptTemplateManagerDialog } from "./ScriptTemplateManagerDialog"
import { AiVoiceStepPanel } from "./AiVoiceStepPanel"
import { SeparateAssetDownloads } from "../components/SeparateAssetDownloads"
import {
  assetFilename,
  buildSrtFromTimedCues,
  downloadTextFile,
  downloadTtsUrl,
  downloadUrlAsFile,
  downloadUrlsAsZip,
  guessExtFromUrlOrType,
} from "@/lib/shotform-separate-assets"
import AiShoppingHome from "./AiShoppingHome"
import { getVeoAvailability } from "./actions"
import { Ver2StepShell } from "./Ver2StepShell"
import { FlowExtensionBridge } from "./FlowExtensionBridge"
import { P, PhoneFrame, StatusDot } from "./premium-ui"
import { BilingualPromptPanel } from "./BilingualPromptPanel"
import {
  AiShoppingEditWorkspace,
  type ShoppingSubtitleStyle,
  DEFAULT_SHOPPING_SUBTITLE_STYLE,
  normalizeShoppingSubtitleStyle,
  SHOPPING_SUBTITLE_BOTTOM_PERCENT,
} from "./AiShoppingEditWorkspace"
import { VOICE_PREVIEW_BGM_OPTIONS, voicePreviewBgmSrc } from "@/lib/shotform-factory-voice-preview-bgm"
import { SceneVideoTtsPreviewDialog } from "./SceneVideoTtsPreviewDialog"
import { KeywordAnalysisStep } from "./KeywordAnalysisStep"
import type {
  CoupangRankedProduct,
  KeywordAnalysisSnapshot,
} from "@/lib/shotform-keyword-analysis-types"
import { enrichTypecastVoice, isRetiredSupertoneVoiceId, RETIRED_SUPERTONE_MESSAGE } from "@/lib/shotform-tts-providers"
import { formatInsightsForScript } from "@/lib/shotform-coupang-review-insights"
import { formatDetailInsightsForScript } from "@/lib/shotform-coupang-detail-insights"
import { renderImageZoomClipObjectUrl } from "@/lib/shotform-image-zoom-clip"
import {
  DEFAULT_SCRIPT_TEMPLATE_ID,
  DEFAULT_VISUAL_FOCUS,
  SHOTFORM_SCRIPT_TEMPLATES,
  SHOTFORM_VISUAL_FOCUS_OPTIONS,
  normalizeVisualFocus,
  sceneCountForSeconds,
  targetCharCountForSeconds,
  type ShotformVisualFocus,
} from "@/lib/shotform-script-templates"
import {
  COUPANG_REVIEWS_PER_PAGE,
  formatReviewPageLabel,
  resolveReviewPageMeta,
} from "@/lib/shotform-coupang-reviews"
import type { CoupangDetailInsights } from "@/lib/shotform-coupang-detail-insights"
import { CollectBriefingPanel } from "./CollectAiInsightPanels"

const DEFAULT_VOICE_ID = "elevenlabs-jB1Cifc2UQbq1gR3wnb0"

function restorableVoiceId(voiceId: string): string {
  return isRetiredSupertoneVoiceId(voiceId) ? DEFAULT_VOICE_ID : voiceId
}

function normalizeReviewImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value.filter(
        (url): url is string =>
          typeof url === "string" &&
          (url.startsWith("http://") ||
            url.startsWith("https://") ||
            url.startsWith("data:image/"))
      )
    )
  )
}

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

/** 장면별 TTS URL을 순서대로 이어 붙여 미리보기/렌더용 단일 오디오 URL을 만든다. */
const mergeSceneTtsAudioUrls = async (audioUrls: string[]): Promise<string> => {
  if (audioUrls.length === 0) throw new Error("병합할 TTS가 없습니다.")
  if (audioUrls.length === 1) return audioUrls[0]!

  const audioContext = new AudioContext()
  try {
    const buffers: AudioBuffer[] = []
    for (const url of audioUrls) {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`TTS 로드 실패 (${response.status})`)
      const arrayBuffer = await response.arrayBuffer()
      buffers.push(await audioContext.decodeAudioData(arrayBuffer.slice(0)))
    }

    const sampleRate = audioContext.sampleRate
    const channelCount = Math.max(...buffers.map((buffer) => buffer.numberOfChannels))
    const outputLengths = buffers.map((buffer) =>
      Math.max(1, Math.round(buffer.duration * sampleRate))
    )
    const mergedBuffer = audioContext.createBuffer(
      channelCount,
      outputLengths.reduce((total, length) => total + length, 0),
      sampleRate
    )

    let sampleOffset = 0
    buffers.forEach((buffer, bufferIndex) => {
      const outputLength = outputLengths[bufferIndex]!
      for (let channel = 0; channel < channelCount; channel += 1) {
        const source = buffer.getChannelData(Math.min(channel, buffer.numberOfChannels - 1))
        const target = mergedBuffer.getChannelData(channel)
        for (let sample = 0; sample < outputLength; sample += 1) {
          const sourceIndex = Math.min(
            source.length - 1,
            Math.floor((sample / sampleRate) * buffer.sampleRate)
          )
          target[sampleOffset + sample] = source[sourceIndex] || 0
        }
      }
      sampleOffset += outputLength
    })

    const mergedBlob = new Blob([audioBufferToWav(mergedBuffer)], { type: "audio/wav" })
    return URL.createObjectURL(mergedBlob)
  } finally {
    await audioContext.close().catch(() => undefined)
  }
}

const trimAudioBufferEdgeSilence = (
  audioContext: AudioContext,
  source: AudioBuffer
): { buffer: AudioBuffer; trimStartMs: number } => {
  const threshold = 0.0025
  const windowSize = 256
  const paddingSamples = Math.round(source.sampleRate * 0.008)
  const hasSignal = (from: number, to: number) => {
    for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
      const samples = source.getChannelData(channel)
      for (let index = from; index < to; index += 1) {
        if (Math.abs(samples[index] || 0) >= threshold) return true
      }
    }
    return false
  }

  let start = 0
  while (
    start < source.length &&
    !hasSignal(start, Math.min(source.length, start + windowSize))
  ) {
    start += windowSize
  }

  let end = source.length
  while (
    end > start &&
    !hasSignal(Math.max(start, end - windowSize), end)
  ) {
    end -= windowSize
  }

  start = Math.max(0, start - paddingSamples)
  end = Math.min(source.length, end + paddingSamples)
  if (start === 0 && end === source.length) return { buffer: source, trimStartMs: 0 }
  if (end - start < source.sampleRate * 0.1) return { buffer: source, trimStartMs: 0 }

  const trimmed = audioContext.createBuffer(
    source.numberOfChannels,
    end - start,
    source.sampleRate
  )
  for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
    trimmed.copyToChannel(source.getChannelData(channel).subarray(start, end), channel)
  }
  return {
    buffer: trimmed,
    trimStartMs: (start / source.sampleRate) * 1000,
  }
}

interface ScriptLine {
  id: number
  text: string
  startTime: number
  endTime: number
  sceneIndex?: number
  alignmentSource?: "provider" | "whisper" | "estimated"
}

const getSceneTtsDurationSeconds = (
  lines: ScriptLine[],
  sceneNarration: string,
  sceneIndex: number
): number | null => {
  const taggedLines = lines.filter((line) => line.sceneIndex === sceneIndex)
  const normalizedNarration = sceneNarration.replace(/\s+/g, "")
  const relevantLines =
    taggedLines.length > 0
      ? taggedLines
      : lines.filter((line) => {
          const normalizedLine = line.text.replace(/\s+/g, "")
          return normalizedLine.length > 0 && normalizedNarration.includes(normalizedLine)
        })

  if (relevantLines.length === 0) return null

  const durationMs = relevantLines.reduce(
    (total, line) => total + Math.max(0, line.endTime - line.startTime),
    0
  )
  return durationMs > 0 ? Math.max(1, Math.ceil(durationMs / 1000)) : null
}

/** BGM 종료 시간 기본값 — 영상 길이와 무관하게 끝까지 재생 (JSON 저장 가능한 유한값) */
const BGM_FULL_LENGTH_SEC = 3600

const getSceneBlinkOpacity = (
  elapsed: number,
  startTime: number,
  endTime: number,
  sceneIndex: number,
  sceneCount: number,
  requestedDuration = 0.04
) => {
  const sceneDuration = Math.max(0, endTime - startTime)
  const blinkDuration = Math.min(requestedDuration, sceneDuration / 2)
  if (blinkDuration <= 0) return 1

  const blinkAtStart = sceneIndex > 0 && elapsed - startTime < blinkDuration
  const blinkAtEnd = sceneIndex < sceneCount - 1 && endTime - elapsed < blinkDuration
  return blinkAtStart || blinkAtEnd ? 0.12 : 1
}

const buildTimedScriptLines = (sceneNarrations: string[], audioDurationSeconds: number): ScriptLine[] => {
  const sceneSentences = sceneNarrations.map((scene) =>
    scene.split(/[.!?。！？]\s*/).map((sentence) => sentence.trim()).filter(Boolean)
  )
  const totalCharacters = Math.max(
    1,
    sceneSentences.flat().reduce((total, sentence) => total + sentence.length, 0)
  )
  const lines: ScriptLine[] = []
  let currentTime = 0

  sceneSentences.forEach((sentences, sceneIndex) => {
    sentences.forEach((sentence) => {
      const duration = (sentence.length / totalCharacters) * audioDurationSeconds * 1000
      lines.push({
        id: lines.length + 1,
        text: sentence,
        startTime: currentTime,
        endTime: currentTime + duration,
        sceneIndex,
        alignmentSource: "estimated",
      })
      currentTime += duration
    })
  })

  return lines
}

const SHOTFORM_SCHEDULES_DB_NAME = "WingsShotFormAiShoppingV2Schedules"
const SHOTFORM_SCHEDULES_DB_STORE = "videos"

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

// 자동화 모드 (공장 모드): 날짜별 상품·이미지·목소리만 정해두면 해당 날에 영상 자동 생성
const FACTORY_SCHEDULES_STORAGE_KEY = "wings_shotform_ai_shopping_v2_factory_schedules"

export interface FactoryScheduleItem {
  id: string
  scheduledDate: string // YYYY-MM-DD
  scheduledTime?: string // HH:mm (발행 시·분)
  productName: string
  productDescription?: string
  productImageBase64: string | null // 썸네일용 작은 base64 가능
  voiceId: string // selectedVoiceId 형식 (ttsmaker-여성1, typecast-xxx 등)
  status: "pending" | "generating" | "ready" | "failed"
  phase?: string // 실행 단계: product | script | video | render | thumbnail | preview
  createdAt: string
  errorMessage?: string
  videoBlobId?: string // ready일 때 ShotForm schedule ID와 동일하게 사용 가능
  projectId?: string // 자동화 모드 자동 생성 시 생성·저장되는 프로젝트 ID
  /** 예약 완료 시 유튜브 업로드에 사용 (제목/설명/태그 생성기 값) */
  youtubeTitle?: string
  youtubeDescription?: string
  youtubeTags?: string[]
  /** 자동화 모드에서 자동 업로드 완료된 경우 true (목록에서 다운로드 버튼 대신 유튜브 업로드 완료 표시) */
  youtubeUploaded?: boolean
  visualFocus?: ShotformVisualFocus
}

const FACTORY_PHASE_LABELS: Record<string, string> = {
  product: "제품 입력",
  script: "대본·TTS 생성",
  video: "이미지 생성",
  render: "영상 생성",
  thumbnail: "썸네일 생성",
  preview: "미리보기·렌더링",
}

// 자동화 모드 단계 순서 및 단계별 이름 (완료/진행 중 표시용)
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

// "될 거예요" → "될거예요"처럼 띄어쓰기된 어미/보조용언을 한 단위로 묶음 (줄 나눔 시 "될" / "거예요"로 끊기지 않도록)
function mergeKoreanEndingSpaces(text: string): string {
  return text
    .replace(/\s+(거예요|거야|것 같아|수 있어|수 있죠|겁니다|습니다|해요|돼요|되죠|될까요)\b/g, (m) => m.trim())
    .replace(/\s+(거예요|거야)\s*$/g, (m) => m.trim())
}

/** 의존명사(수·것·거·줄·뿐)는 앞뒤 단어와 한 덩어리로 묶어 자막이 "수 있고,"처럼 시작하지 않게 한다. */
function getSubtitlePhrases(text: string): string[] {
  if (!text || !text.trim()) return []
  const merged = mergeKoreanEndingSpaces(text.trim())
  const clauses = merged.match(/[^,，.!?。！？]+[,，.!?。！？]?/g) || [merged]
  const phrases: string[] = []
  const semanticEnding =
    /(고|며|지만|는데|해서|하여|하면|라면|니까|므로|거나|다가|려고|도록|거든|잖아|잖아요|거예요|겁니다|합니다|됩니다|돼요|해요|예요|이에요|죠|니다)[,，.!?。！？]?$/

  for (const clause of clauses) {
    const tokens = glueKoreanWordUnits(clause.trim().split(/\s+/).filter(Boolean))
    let current: string[] = []
    for (const token of tokens) {
      const candidate = [...current, token].join(" ")
      const candidateLength = candidate.replace(/\s/g, "").length
      if (current.length > 0 && candidateLength > 10) {
        phrases.push(current.join(" ").trim())
        current = []
      }
      current.push(token)
      const hardBoundary = /[,，.!?。！？]$/.test(token)
      const semanticBoundary = current.length >= 2 && semanticEnding.test(token)
      const compactLength = current.join("").length
      const safetyBoundary = current.length >= 3 || compactLength >= 9
      if (hardBoundary || semanticBoundary || safetyBoundary) {
        phrases.push(current.join(" ").trim())
        current = []
      }
    }
    if (current.length) phrases.push(current.join(" ").trim())
  }

  return phrases.filter(Boolean).length ? phrases.filter(Boolean) : [merged]
}

function getSubtitlePhraseIndex(phrases: string[], timeInLine: number, lineDuration: number): number {
  if (phrases.length <= 1 || lineDuration <= 0) return 0
  const weights = phrases.map((phrase) => Math.max(1, phrase.replace(/\s/g, "").length))
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  const targetWeight = Math.min(1, Math.max(0, timeInLine / lineDuration)) * totalWeight
  let accumulated = 0
  for (let index = 0; index < weights.length; index += 1) {
    accumulated += weights[index]
    if (targetWeight < accumulated) return index
  }
  return phrases.length - 1
}

function getSubtitlePhraseRanges(phrases: string[], start: number, end: number) {
  const weights = phrases.map((phrase) => Math.max(1, phrase.replace(/\s/g, "").length))
  const totalWeight = Math.max(1, weights.reduce((sum, weight) => sum + weight, 0))
  const span = Math.max(0, end - start)
  let cursor = start
  return phrases.map((text, index) => {
    const phraseEnd =
      index === phrases.length - 1 ? end : cursor + span * (weights[index] / totalWeight)
    const range = { text, start: cursor, end: phraseEnd }
    cursor = phraseEnd
    return range
  })
}

type SubtitleAlignment = {
  characters?: string[]
  character_start_times_seconds?: number[]
  character_end_times_seconds?: number[]
}

type AlignedWord = { word: string; start: number; end: number }

function buildCharacterAlignedScriptLines(
  sceneNarrations: string[],
  alignment: SubtitleAlignment
): ScriptLine[] | null {
  const characters = alignment.characters || []
  const starts = alignment.character_start_times_seconds || []
  const ends = alignment.character_end_times_seconds || []
  if (!characters.length || starts.length !== characters.length || ends.length !== characters.length) {
    return null
  }

  // 자막 문구는 띄어쓰기를 붙여 쓰기도 해서("될 거예요"→"될거예요") 공백을 뺀 글자끼리 맞춘다.
  // 원문 위치로 그대로 찾으면 못 찾고 커서로 대신하면서 자막이 점점 밀린다.
  const compactIndex: number[] = []
  let compactText = ""
  characters.forEach((ch, i) => {
    if (/s/.test(ch)) return
    compactText += ch
    compactIndex.push(i)
  })
  const lines: ScriptLine[] = []
  let cursor = 0

  sceneNarrations.forEach((scene, sceneIndex) => {
    getSubtitlePhrases(scene).forEach((phrase) => {
      const compactPhrase = phrase.replace(/s+/g, "")
      if (!compactPhrase || !compactIndex.length) return
      let pos = compactText.indexOf(compactPhrase, cursor)
      if (pos < 0) pos = Math.min(cursor, compactIndex.length - 1)
      const lastPos = Math.min(compactIndex.length - 1, pos + compactPhrase.length - 1)
      const startIndex = compactIndex[pos]
      const endIndex = compactIndex[lastPos]
      const startTime = Number(starts[startIndex])
      const endTime = Number(ends[endIndex])
      if (Number.isFinite(startTime) && Number.isFinite(endTime) && endTime > startTime) {
        lines.push({
          id: lines.length + 1,
          text: phrase,
          startTime: startTime * 1000,
          endTime: endTime * 1000,
          sceneIndex,
          alignmentSource: "provider",
        })
      }
      cursor = lastPos + 1
    })
  })

  return lines.length ? lines : null
}

function buildWordAlignedScriptLines(
  sceneNarrations: string[],
  words: AlignedWord[]
): ScriptLine[] | null {
  if (!words.length) return null
  const phraseEntries = sceneNarrations.flatMap((scene, sceneIndex) =>
    getSubtitlePhrases(scene).map((text) => ({
      text,
      sceneIndex,
      weight: Math.max(1, text.replace(/\s/g, "").length),
    }))
  )
  if (!phraseEntries.length) return null

  const wordWeights = words.map((word) => Math.max(1, word.word.replace(/\s/g, "").length))
  const totalPhraseWeight = phraseEntries.reduce((sum, phrase) => sum + phrase.weight, 0)
  const totalWordWeight = wordWeights.reduce((sum, weight) => sum + weight, 0)
  const lines: ScriptLine[] = []
  let phraseWeightCursor = 0
  let wordStartIndex = 0
  let wordWeightCursor = 0

  phraseEntries.forEach((phrase) => {
    phraseWeightCursor += phrase.weight
    const targetWordWeight = (phraseWeightCursor / totalPhraseWeight) * totalWordWeight
    let wordEndIndex = wordStartIndex
    while (
      wordEndIndex < words.length - 1 &&
      wordWeightCursor + wordWeights[wordEndIndex] < targetWordWeight
    ) {
      wordWeightCursor += wordWeights[wordEndIndex]
      wordEndIndex += 1
    }
    const firstWord = words[wordStartIndex]
    const lastWord = words[wordEndIndex]
    if (firstWord && lastWord) {
      lines.push({
        id: lines.length + 1,
        text: phrase.text,
        startTime: firstWord.start * 1000,
        endTime: lastWord.end * 1000,
        sceneIndex: phrase.sceneIndex,
        alignmentSource: "whisper",
      })
    }
    wordWeightCursor += wordWeights[wordEndIndex] || 0
    wordStartIndex = Math.min(words.length - 1, wordEndIndex + 1)
  })

  return lines.length ? lines : null
}

// 자동화 모드 6단계 스테퍼용: phase → 스텝 인덱스 (0=제품입력, 1=대본·TTS, 2=이미지, 3=영상, 4=썸네일, 5=완료)
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

const SHOPPING_VIDEO_MODEL_META: Record<
  ShoppingVideoGenerationModel,
  { label: string; description: string; maxDuration: number }
> = {
  "seedance-1-pro-fast": {
    label: "Seedance 1 Pro Fast",
    description:
      "bytedance/seedance-1-pro-fast · 이미지→영상 · 장면 대사 길이 비례",
    maxDuration: 12,
  },
  "seedance-1.5-pro": {
    label: "Seedance 1.5 Pro",
    description:
      "bytedance/seedance-1.5-pro · 무음 · 720p · 4~12초",
    maxDuration: 12,
  },
  veo: {
    label: "Google Veo (Flow 모델)",
    description: "Google Flow 와 같은 Veo 모델 · 공식 Gemini API · 9:16 · 4·6·8초 · 초당 과금",
    maxDuration: 8,
  },
  "p-video-draft": {
    label: "P-Video 720p Draft",
    description:
      "prunaai/p-video · 720p Draft · 24fps · 무음 · 초당 $0.005 · 1~10초",
    maxDuration: 10,
  },
}

export default function AiShoppingVer2Page() {
  const shoppingBrandLabel = "AI 쇼핑 숏폼"
  const [keywordAnalysis, setKeywordAnalysis] = useState<KeywordAnalysisSnapshot | null>(null)
  const [selectedKeywordProduct, setSelectedKeywordProduct] = useState<CoupangRankedProduct | null>(null)
  const [productName, setProductName] = useState("")
  const [productDescription, setProductDescription] = useState("")
  const [productImage, setProductImage] = useState<string | null>(null)
  const [productImageFile, setProductImageFile] = useState<File | null>(null)
  const [productImageAspectRatio, setProductImageAspectRatio] = useState<number | null>(null) // 제품 이미지 비율 (width/height)

  // ver2 9단계 파이프라인: 수집 단계 관련 상태
  const [coupangUrl, setCoupangUrl] = useState("")
  const [productJson, setProductJson] = useState("")
  const [productPrice, setProductPrice] = useState("")
  const [productDelivery, setProductDelivery] = useState("")
  const [reviews, setReviews] = useState<ProductReviewItem[]>([])
  const [reviewImages, setReviewImages] = useState<string[]>([])
  /** collector = 수집기 / manual = 제품명·리뷰 직접 붙여넣기 */
  const [collectMode, setCollectMode] = useState<"collector" | "manual">("collector")
  const [manualReviewPaste, setManualReviewPaste] = useState("")
  /** 리뷰 목록 UI 페이지 (벤치마킹: 페이지당 5개) */
  const [reviewListPage, setReviewListPage] = useState(1)
  /** 상단 제품사진 (AI가 고른 베스트 컷 최대 2장) */
  const [productImages, setProductImages] = useState<string[]>([])
  /** 쿠팡 상품 상세페이지 이미지 URL들 */
  const [detailImages, setDetailImages] = useState<string[]>([])
  /** 제품/상세 사진 클릭 확대 */
  const [imagePreview, setImagePreview] = useState<{
    urls: string[]
    index: number
    title: string
  } | null>(null)
  /** 미리보기 안 돋보기 배율 (1 = 기본) */
  const [imagePreviewZoom, setImagePreviewZoom] = useState(1)
  const imagePreviewScrollRef = useRef<HTMLDivElement>(null)
  const [reviewInsights, setReviewInsights] = useState<CoupangReviewInsightsData | null>(null)
  const [detailInsights, setDetailInsights] = useState<CoupangDetailInsights | null>(null)
  const [reviewCountText, setReviewCountText] = useState("")

  // ver2: 스토리보드 단계
  const [storyboardScenes, setStoryboardScenes] = useState<StoryboardScene[]>([])
  const [sceneCount, setSceneCount] = useState(6)

  // ver2: 보이스(TTS/녹음) 단계
  const [voiceRecordings, setVoiceRecordings] = useState<Record<string, string>>({})
  const [showRecordingDialog, setShowRecordingDialog] = useState(false)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const [recordedVoiceUrl, setRecordedVoiceUrl] = useState<string>("")

  // ver2: 이미지 단계 - 무료 이미지 URL / Pixabay
  const [freeImageUrls, setFreeImageUrls] = useState<string[]>([])
  const [newFreeImageUrl, setNewFreeImageUrl] = useState("")
  const [showPixabayDialog, setShowPixabayDialog] = useState(false)
  const [pixabayQuery, setPixabayQuery] = useState("")
  const [pixabayHits, setPixabayHits] = useState<PixabayImageHit[]>([])
  const [pixabayTotal, setPixabayTotal] = useState(0)
  const [isSearchingPixabay, setIsSearchingPixabay] = useState(false)
  const [pixabayError, setPixabayError] = useState("")
  /** null이면 freeImageUrls에 추가, 0|1|2면 해당 장면 슬롯에 적용 */
  const [pixabayTargetSlot, setPixabayTargetSlot] = useState<number | null>(null)
  const sceneImageUploadRefs = useRef<Array<HTMLInputElement | null>>([null, null, null])

  // AI이미지 단계 — 장면 기반 3패널 UI
  const [selectedImageSceneIndex, setSelectedImageSceneIndex] = useState(0)
  const [selectedImageSlots, setSelectedImageSlots] = useState<Set<number>>(new Set())
  const [imageModel, setImageModel] = useState<ImageModelId>("nano-banana")
  const [scenePixabay, setScenePixabay] = useState<Record<string, ScenePixabayState>>({})
  const [bulkImageGenerationIndex, setBulkImageGenerationIndex] = useState<number | null>(null)
  const getPipelineSceneIndices = () => {
    return storyboardScenes
      .map((_, index) => index)
      .filter((index) => Boolean(imageUrls[index]))
  }

  // AI영상 단계 — 장면 선택 / Pixabay 동영상 / 업로드
  const [selectedVideoSceneIndex, setSelectedVideoSceneIndex] = useState(0)
  const [videoTtsPreviewOpen, setVideoTtsPreviewOpen] = useState(false)
  const [selectedVideoSlots, setSelectedVideoSlots] = useState<Set<number>>(new Set())
  const [showPixabayVideoDialog, setShowPixabayVideoDialog] = useState(false)
  const [pixabayVideoQuery, setPixabayVideoQuery] = useState("")
  const [pixabayVideoHits, setPixabayVideoHits] = useState<PixabayVideoHit[]>([])
  const [pixabayVideoTotal, setPixabayVideoTotal] = useState(0)
  const [isSearchingPixabayVideo, setIsSearchingPixabayVideo] = useState(false)
  const [pixabayVideoError, setPixabayVideoError] = useState("")
  const [pixabayVideoTargetSlot, setPixabayVideoTargetSlot] = useState<number | null>(null)
  const [showVideoPromptEditor, setShowVideoPromptEditor] = useState(false)
  const [editingVideoPrompt, setEditingVideoPrompt] = useState("")
  const sceneVideoUploadRefs = useRef<Array<HTMLInputElement | null>>([null, null, null])
  const VIDEO_SCENE_NAMES = ["제품 사용 영상", "디테일 영상", "다른 배경 영상"] as const

  const [script, setScript] = useState("")
  const [videoUrl, setVideoUrl] = useState<string>("")
  const [imageUrls, setImageUrls] = useState<string[]>([]) // 대본 장면 순서의 이미지 URL
  const [convertedVideoUrls, setConvertedVideoUrls] = useState<Map<number, string>>(new Map()) // 각 장면별로 변환된 영상 URL 저장
  const [imagePrompts, setImagePrompts] = useState<ImagePromptItem[]>([]) // 대본 장면 순서의 이미지 프롬프트
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false) // 프롬프트 생성 중 여부
  const [promptsGenerated, setPromptsGenerated] = useState(false) // 프롬프트 생성 완료 여부
  const [videoPrompts, setVideoPrompts] = useState<Map<number, string>>(new Map()) // 각 장면별 영상 프롬프트 저장 (인덱스 -> 프롬프트)
  // Google Veo(Flow 모델) 공식 API 사용 가능 여부 (키 권한 + VEO_MODEL)
  const [veoReady, setVeoReady] = useState(false)
  useEffect(() => {
    getVeoAvailability().then((r) => setVeoReady(r.ready)).catch(() => setVeoReady(false))
  }, [])
  const [flowCopied, setFlowCopied] = useState(false)
  const [videoGenerationModel, setVideoGenerationModel] =
    useState<ShoppingVideoGenerationModel>("seedance-1-pro-fast")
  const [isGeneratingVideoPrompts, setIsGeneratingVideoPrompts] = useState<Map<number, boolean>>(new Map()) // 각 장면별 영상 프롬프트 생성 중 여부
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [isConvertingToVideo, setIsConvertingToVideo] = useState<Map<number, boolean>>(new Map()) // 각 장면별 변환 중 여부
  const [isRegeneratingImage, setIsRegeneratingImage] = useState<Map<number, boolean>>(new Map()) // 각 이미지별 재생성 중 여부
  const [customImagePrompts, setCustomImagePrompts] = useState<Map<number, string>>(new Map()) // 각 이미지별 추가 프롬프트 (한국어)
  const [isMergingVideos, setIsMergingVideos] = useState(false) // 영상 합치기 중 여부
  /** Seedance 없이 AI이미지 + 줌인 클립으로 진행 */
  const [useImageZoomInsteadOfAiVideo, setUseImageZoomInsteadOfAiVideo] = useState(false)
  /** 줌인 클립을 실제로 만든 뒤에만 true (Seedance 영상이 있어도 줌 모드 통과 방지) */
  const [imageZoomClipsPrepared, setImageZoomClipsPrepared] = useState(false)
  const [isPreparingImageZoomClips, setIsPreparingImageZoomClips] = useState(false)
  type Ver2Step =
    | "keywordAnalysis"
    | "collect"
    | "scriptJson"
    | "voice"
    | "images"
    | "videos"
    | "thumbnail"
    | "preview"
    | "metadata"
  const VER2_PIPELINE_STEPS: Array<{ step: Ver2Step; label: string; icon: typeof ShoppingBag }> = [
    { step: "keywordAnalysis", label: "키워드 분석", icon: BarChart3 },
    { step: "collect", label: "제품 서칭", icon: ShoppingBag },
    { step: "scriptJson", label: "대본생성", icon: FileJson },
    { step: "voice", label: "AI 음성", icon: Mic },
    { step: "images", label: "AI이미지", icon: ImageIcon },
    { step: "videos", label: "AI영상", icon: Film },
    { step: "thumbnail", label: "썸네일", icon: ImageIcon },
    { step: "preview", label: "AI영상편집", icon: Play },
    { step: "metadata", label: "유튜브 정보", icon: FileText },
  ]
  const [activeStep, setActiveStep] = useState<Ver2Step>("keywordAnalysis")
  const [error, setError] = useState<string>("")
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number }>({ current: 0, total: 3 })
  
  // TTS 및 영상 렌더링 관련 상태
  const [scenes, setScenes] = useState<string[]>([]) // 3개 장면 텍스트
  const [scriptLines, setScriptLines] = useState<ScriptLine[]>([]) // 자막용 라인
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string>("")
  const [sceneTtsTracks, setSceneTtsTracks] = useState<SceneTtsTrack[]>([])
  /** TTS 생성·미리듣기에 공통 적용되는 배속 (엔진 API speed) */
  const [ttsSpeed, setTtsSpeed] = useState(1.2)
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false)
  const [ttsProgress, setTtsProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 })
  const [isRendering, setIsRendering] = useState(false)
  const [isServerDownloading, setIsServerDownloading] = useState(false) // 서버 다운로드(Cloud Run 렌더) 중
  const [proRenderStatus, setProRenderStatus] = useState<"idle" | "uploading" | "rendering">("idle") // 고품질 렌더 (v2 엔진)
  /** 모바일/인앱에서 자동 다운로드가 안 될 때 보여줄 '영상 저장' 링크 (탭하여 저장) */
  const [serverDownloadLink, setServerDownloadLink] = useState<{ url: string; fileName: string } | null>(null)
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false) // 미리보기 생성 중 상태
  const [previewGenerated, setPreviewGenerated] = useState(false) // 미리보기 생성 완료 여부
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("elevenlabs-jB1Cifc2UQbq1gR3wnb0") // 기본: ElevenLabs
  const [customElevenLabsVoices, setCustomElevenLabsVoices] = useState<Array<{ id: string; name: string }>>([]) // 사용자 추가 일레븐랩스 목소리
  const [customElevenLabsVoiceId, setCustomElevenLabsVoiceId] = useState<string>("") // 사용자가 입력한 ElevenLabs 음성 ID
  const [typecastVoices, setTypecastVoices] = useState<
    Array<{
      voice_id: string
      name: string
      name_en?: string
      styles?: string[]
      thumbnail_image_url?: string
      gender?: string
      age?: string
      use_cases?: string[]
    }>
  >([])
  const [isLoadingTypecastVoices, setIsLoadingTypecastVoices] = useState(false)
  const [selectedTypecastVoiceId, setSelectedTypecastVoiceId] = useState("")
  const [selectedTypecastEmotion, setSelectedTypecastEmotion] = useState("normal")
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
  const previewVideoHostRef = useRef<HTMLDivElement | null>(null)
  const [currentVideoIndex, setCurrentVideoIndex] = useState<number>(-1) // 현재 재생 중인 영상 인덱스
  const [previousVideoIndex, setPreviousVideoIndex] = useState<number>(-1) // 이전 재생 중인 영상 인덱스
  const [videoTransitionOpacity, setVideoTransitionOpacity] = useState<number>(1) // 영상 전환 효과용 opacity
  
  // Canvas 및 미리보기 관련
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const previewContainerRef = useRef<HTMLDivElement | null>(null)
  
  // 썸네일 생성기 관련
  const [thumbnailUrl, setThumbnailUrl] = useState<string>("")
  const [separateAssetBusy, setSeparateAssetBusy] = useState<string | null>(null)
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false)
  const [thumbnailHookingText, setThumbnailHookingText] = useState<{ line1: string; line2: string }>({ line1: "", line2: "" })
  const [thumbnailStudioDesign, setThumbnailStudioDesign] = useState<MvpThumbnailDesign | null>(null)
  const thumbnailCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [draggingBgmHandle, setDraggingBgmHandle] = useState<"start" | "end" | null>(null) // BGM 핸들 드래그 중

  const [draggingSfxHandle, setDraggingSfxHandle] = useState<"start" | "end" | null>(null) // 효과음 핸들 드래그 중
  const timelineRef = useRef<HTMLDivElement | null>(null) // 타임라인 재생바 ref
  const bgmTimelineRef = useRef<HTMLDivElement | null>(null) // BGM 타임라인 ref
  const sfxTimelineRef = useRef<HTMLDivElement | null>(null) // 효과음 타임라인 ref
  const [thumbnailMode, setThumbnailMode] = useState<"ai" | "manual">("ai") // AI 생성 또는 직접 생성
  const [thumbnailImages, setThumbnailImages] = useState<Array<{ url: string; text: { line1: string; line2: string }; isCustom: boolean }>>([]) // 여러 썸네일 저장
  const [selectedThumbnailIndex, setSelectedThumbnailIndex] = useState<number>(-1) // 선택된 썸네일 인덱스
  const [thumbnailTemplateStackId, setThumbnailTemplateStackId] = useState(
    THUMBNAIL_TEMPLATE_STACKS[0]?.id || "deal-proof-stack"
  )
  const [thumbnailStyleVariantId, setThumbnailStyleVariantId] = useState(
    THUMBNAIL_STYLE_VARIANTS[0]?.id || "product-poster-clean"
  )
  const [thumbnailPhraseCandidates, setThumbnailPhraseCandidates] = useState<ThumbnailPhraseTitleCandidate[]>([])
  const [selectedThumbnailPhraseIndex, setSelectedThumbnailPhraseIndex] = useState(-1)
  const [isGeneratingThumbnailPhrases, setIsGeneratingThumbnailPhrases] = useState(false)
  const [thumbnailVideoTitleDraft, setThumbnailVideoTitleDraft] = useState("")
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
  /** 대본 목표 길이(초) — 슬라이더 */
  const [targetScriptSeconds, setTargetScriptSeconds] = useState(30)
  const [selectedScriptTemplateId, setSelectedScriptTemplateId] = useState(
    DEFAULT_SCRIPT_TEMPLATE_ID
  )
  const [visualFocus, setVisualFocus] =
    useState<ShotformVisualFocus>(DEFAULT_VISUAL_FOCUS)
  const [showTemplateManager, setShowTemplateManager] = useState(false)
  const [scriptTitle, setScriptTitle] = useState("")
  const [isEditingScript, setIsEditingScript] = useState(false) // 대본 편집 모드
  const [editedScript, setEditedScript] = useState("") // 편집된 대본
  const [scriptParts, setScriptParts] = useState<Array<{ part: string; text: string; startIndex: number; endIndex: number }>>([]) // 대본 파트 분석 결과
  const [isAnalyzingScript, setIsAnalyzingScript] = useState(false) // 대본 분석 중 여부
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  
  // 자막 스타일 설정 (CapCut형 편집 UI)
  const [subtitleStyle, setSubtitleStyle] = useState<ShoppingSubtitleStyle>(DEFAULT_SHOPPING_SUBTITLE_STYLE)

  // 열려 있던 세션/저장된 프로젝트의 예전 그림자 디폴트(12, -45)를 새 디폴트(3, -46)로 맞춤
  useEffect(() => {
    setSubtitleStyle((prev) => normalizeShoppingSubtitleStyle(prev))
  }, [])

  const [editVideoZoom, setEditVideoZoom] = useState(100)
  const [editVideoOffsetX, setEditVideoOffsetX] = useState(0)
  const [editVideoOffsetY, setEditVideoOffsetY] = useState(0)
  const [originalClipSound, setOriginalClipSound] = useState(false)
  const [editWorkspaceTab, setEditWorkspaceTab] = useState<"subtitle" | "autoedit">("subtitle")
  const [editSettingsTab, setEditSettingsTab] = useState<"settings" | "templates">("settings")
  
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
  const [transitionDuration, setTransitionDuration] = useState(0.04) // 장면 경계의 순간 깜빡임 시간 (초)
  
  // 제목/설명/태그 자동 생성
  const [youtubeTitle, setYoutubeTitle] = useState("")
  const [youtubeDescription, setYoutubeDescription] = useState("")
  const [youtubeTags, setYoutubeTags] = useState<string[]>([])
  const [youtubeTagsDraft, setYoutubeTagsDraft] = useState("")
  const updateYoutubeTags = (tags: string[]) => {
    setYoutubeTags(tags)
    setYoutubeTagsDraft(tags.join(", "))
  }
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false)
  const [copiedTitle, setCopiedTitle] = useState(false)
  const [copiedDescription, setCopiedDescription] = useState(false)
  const [copiedTags, setCopiedTags] = useState(false)

  // 프로젝트 관리 상태
  const [projects, setProjects] = useState<ShoppingProject[]>([])
  const [currentProject, setCurrentProject] = useState<ShoppingProject | null>(null)
  const [showProjectList, setShowProjectList] = useState(true) // 프로젝트 목록 화면 표시 여부
  const [mobileNavOpen, setMobileNavOpen] = useState(false) // 모바일 단계 사이드바(드로어)
  const [showFactoryView, setShowFactoryView] = useState(false) // 자동화 모드(공장 모드) 화면
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
  /** 자동화 모드 백그라운드 파이프라인 대기 큐 (순차 처리용) */
  const [factoryPipelineQueue, setFactoryPipelineQueue] = useState<FactoryScheduleItem[]>([])
  /** 현재 파이프라인 실행 중인 예약 ID (목록에서 '작업 중' 표시용) */
  const [factoryPipelineRunningItemId, setFactoryPipelineRunningItemId] = useState<string | null>(null)
  const factoryPipelineRunningRef = useRef(false)
  const [showFactorySettingsDialog, setShowFactorySettingsDialog] = useState(false)
  const [showFactoryPasswordDialog, setShowFactoryPasswordDialog] = useState(false)
  const [factoryPasswordInput, setFactoryPasswordInput] = useState("")
  const [uploadingFactoryId, setUploadingFactoryId] = useState<string | null>(null)
  const [youtubeChannelName, setYoutubeChannelName] = useState<string | null>(null) // 연동된 유튜브 채널명 (자동화 모드 → 자동 업로드용)
  const [youtubeClientId, setYoutubeClientId] = useState("")
  const [youtubeClientSecret, setYoutubeClientSecret] = useState("")
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isSavingProject, setIsSavingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDescription, setNewProjectDescription] = useState("")
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false)
  /** empty: 빈 새 프로젝트 / saveCurrent: 현재 작업물을 이름으로 저장 */
  const [createProjectMode, setCreateProjectMode] = useState<"empty" | "saveCurrent">("empty")
  /** 새 프로젝트 타입: 일반 9단계 vs 고퀄리티 Seedance 2.5 */
  const [newProjectQualityMode, setNewProjectQualityMode] = useState<"standard" | "high">("standard")
  const [projectSearchQuery, setProjectSearchQuery] = useState("") // 프로젝트 검색어
  const [userId, setUserId] = useState<string>("") // 사용자 ID
  const [isEditingProjectName, setIsEditingProjectName] = useState(false)
  const [editingProjectName, setEditingProjectName] = useState("")

  // 윙스봇 챗봇 상태
  const [isChatbotOpen, setIsChatbotOpen] = useState(false) // 챗봇 열림/닫힘
  const [chatbotMessages, setChatbotMessages] = useState<Array<{ type: "user" | "assistant"; content: string }>>([]) // 챗봇 메시지
  const [chatbotInput, setChatbotInput] = useState<string>("") // 챗봇 입력
  const [isChatbotGenerating, setIsChatbotGenerating] = useState(false) // 챗봇 응답 생성 중
  /** 윙스봇 플로팅 위치 (left/top px). null이면 우하단 기본 */
  const [wingsBotPos, setWingsBotPos] = useState<{ x: number; y: number } | null>(null)
  const [isDraggingWingsBot, setIsDraggingWingsBot] = useState(false)
  const wingsBotDragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
    /** 버튼 클릭으로 열기 vs 드래그만 */
    mode: "fab" | "panel"
  } | null>(null)

  const WINGS_BOT_POS_KEY = "shotform_ai_shopping_wingsbot_pos"

  const getWingsBotDefaultPos = (open: boolean) => {
    if (typeof window === "undefined") return { x: 24, y: 24 }
    const w = open ? 384 : 64
    const h = open ? 600 : 64
    return {
      x: Math.max(8, window.innerWidth - w - 24),
      y: Math.max(8, window.innerHeight - h - 24),
    }
  }

  const clampWingsBotPos = (x: number, y: number, open: boolean) => {
    if (typeof window === "undefined") return { x, y }
    const w = open ? 384 : 64
    const h = open ? Math.min(600, window.innerHeight - 16) : 64
    return {
      x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - w - 8)),
      y: Math.min(Math.max(8, y), Math.max(8, window.innerHeight - h - 8)),
    }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WINGS_BOT_POS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { x?: number; y?: number }
      if (typeof parsed.x === "number" && typeof parsed.y === "number") {
        setWingsBotPos(clampWingsBotPos(parsed.x, parsed.y, false))
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 최초 1회 복원
  }, [])

  const resolveWingsBotPos = (open: boolean) =>
    clampWingsBotPos(
      wingsBotPos?.x ?? getWingsBotDefaultPos(open).x,
      wingsBotPos?.y ?? getWingsBotDefaultPos(open).y,
      open
    )

  const onWingsBotPointerDown = (
    event: ReactPointerEvent,
    mode: "fab" | "panel"
  ) => {
    if (event.button !== 0) return
    const open = mode === "panel" || isChatbotOpen
    const pos = resolveWingsBotPos(open)
    wingsBotDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pos.x,
      originY: pos.y,
      moved: false,
      mode,
    }
    setIsDraggingWingsBot(true)
    try {
      ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }
  }

  const onWingsBotPointerMove = (event: ReactPointerEvent) => {
    const drag = wingsBotDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (!drag.moved && Math.hypot(dx, dy) < 6) return
    drag.moved = true
    const open = drag.mode === "panel" || isChatbotOpen
    setWingsBotPos(
      clampWingsBotPos(drag.originX + dx, drag.originY + dy, open)
    )
  }

  const onWingsBotPointerUp = (event: ReactPointerEvent) => {
    const drag = wingsBotDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const wasDrag = drag.moved
    const mode = drag.mode
    wingsBotDragRef.current = null
    setIsDraggingWingsBot(false)
    try {
      ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }
    setWingsBotPos((prev) => {
      if (prev) {
        try {
          localStorage.setItem(WINGS_BOT_POS_KEY, JSON.stringify(prev))
        } catch {
          /* ignore */
        }
      }
      return prev
    })
    // 드래그가 아니면 FAB 클릭 → 챗봇 열기
    if (!wasDrag && mode === "fab") {
      setIsChatbotOpen(true)
      setWingsBotPos((prev) => {
        const next = clampWingsBotPos(
          prev?.x ?? getWingsBotDefaultPos(true).x,
          prev?.y ?? getWingsBotDefaultPos(true).y,
          true
        )
        try {
          localStorage.setItem(WINGS_BOT_POS_KEY, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })
      if (chatbotMessages.length === 0) {
        setChatbotMessages([
          {
            type: "assistant",
            content: "안녕하세요! 윙스봇입니다. 무엇을 도와드릴까요?",
          },
        ])
      }
    }
  }

  // 네이버 인기 키워드 상태
  const [trendingKeywords, setTrendingKeywords] = useState<string[]>([])
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(false)
  const [showKeywordsDialog, setShowKeywordsDialog] = useState(false)

  // ver2: 상품 JSON 붙여넣기 → 자동 파싱 (이름/가격/배송/상세/이미지/리뷰)
  const handleParseProductJson = (raw: string) => {
    if (!raw.trim()) return
    try {
      const parsed = JSON.parse(raw)
      const name = parsed.productName || parsed.name || parsed.title
      const price = parsed.price || parsed.productPrice
      const delivery = parsed.delivery || parsed.productDelivery || parsed.deliveryInfo
      const description =
        parsed.productDescription ||
        parsed.description ||
        parsed.detailText ||
        parsed.shortDescription ||
        ""
      const images: string[] = [
        ...(parsed.images || parsed.imageUrls || (parsed.image ? [parsed.image] : [])),
        ...(Array.isArray(parsed.detailImages) ? parsed.detailImages : []),
      ].filter((u: unknown): u is string => typeof u === "string" && u.startsWith("http"))
      const uniqImages = Array.from(new Set(images))
      const parsedReviews: ProductReviewItem[] = Array.isArray(parsed.reviews)
        ? parsed.reviews
            .map((r: any, i: number) => {
              const content = String(r.content || r.text || r.review || "").trim()
              if (!content) return null
              const meta = resolveReviewPageMeta(
                {
                  page: typeof r.page === "number" ? r.page : undefined,
                  indexOnPage: typeof r.indexOnPage === "number" ? r.indexOnPage : undefined,
                },
                i
              )
              return {
                author: r.author || r.name || undefined,
                rating: typeof r.rating === "number" ? r.rating : undefined,
                content,
                date: r.date || undefined,
                page: meta.page,
                indexOnPage: meta.indexOnPage,
                images: normalizeReviewImageUrls(r.images),
              }
            })
            .filter(Boolean)
        : []
      if (name) setProductName(String(name))
      if (price) setProductPrice(String(price))
      if (delivery) setProductDelivery(String(delivery))
      if (description && !productDescription.trim()) setProductDescription(String(description).slice(0, 4000))
      if (uniqImages[0] && !productImage) setProductImage(uniqImages[0])
      if (parsedReviews.length > 0) {
        setReviews(parsedReviews as ProductReviewItem[])
        setReviewListPage(1)
      }
      setReviewImages(
        normalizeReviewImageUrls([
          ...normalizeReviewImageUrls(parsed.reviewImages),
          ...parsedReviews.flatMap((review) => review?.images || []),
        ])
      )
    } catch {
      // JSON 형식이 아니면 원본 텍스트만 productJson에 저장 (파싱 생략)
    }
  }

  const handleAddReview = () =>
    setReviews((prev) => {
      const meta = resolveReviewPageMeta({}, prev.length)
      return [...prev, { content: "", page: meta.page, indexOnPage: meta.indexOnPage }]
    })
  const handleUpdateReview = (index: number, patch: Partial<ProductReviewItem>) =>
    setReviews((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  const handleRemoveReview = (index: number) => {
    setReviews((prev) => prev.filter((_, i) => i !== index))
    setReviewListPage((p) => {
      const nextLen = Math.max(0, reviews.length - 1)
      const maxPage = Math.max(1, Math.ceil(nextLen / COUPANG_REVIEWS_PER_PAGE) || 1)
      return Math.min(p, maxPage)
    })
  }

  // ver2: 스토리보드 장면 관리
  const handleAddStoryboardScene = () =>
    setStoryboardScenes((prev) => [
      ...prev,
      {
        id: `scene-${Date.now()}-${prev.length}`,
        title: `M${prev.length + 1}, S1`,
        narration: "",
        imagePrompt: "",
        motionPrompt: "",
      },
    ])
  const handleUpdateStoryboardScene = (id: string, patch: Partial<StoryboardScene>) =>
    setStoryboardScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  const handleRemoveStoryboardScene = (id: string) =>
    setStoryboardScenes((prev) => prev.filter((s) => s.id !== id))

  // ver2: 내 목소리 녹음 (MediaRecorder)
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recordedChunksRef.current = []
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data)
      }
      mr.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" })
        const url = URL.createObjectURL(blob)
        setRecordedVoiceUrl(url)
        stream.getTracks().forEach((t) => t.stop())
      }
      mediaRecorderRef.current = mr
      mr.start()
      setIsRecordingVoice(true)
    } catch (err) {
      console.error("[Shopping] 마이크 접근 실패:", err)
      alert("마이크 접근에 실패했습니다. 브라우저 권한을 확인해주세요.")
    }
  }
  const handleStopRecording = () => {
    mediaRecorderRef.current?.stop()
    setIsRecordingVoice(false)
  }
  const handleSaveRecordedVoice = () => {
    if (!recordedVoiceUrl) return
    setVoiceRecordings((prev) => ({ ...prev, main: recordedVoiceUrl }))
    setTtsAudioUrl(recordedVoiceUrl)
    setShowRecordingDialog(false)
  }

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

  // 자동화 모드 목록 로드
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

  // 미리보기 열리거나 장 바뀌면 돋보기 배율 초기화 (상세는 가로 맞춤 기본)
  useEffect(() => {
    if (!imagePreview) {
      setImagePreviewZoom(1)
      return
    }
    setImagePreviewZoom(imagePreview.title.includes("상세") ? 1.25 : 1)
    requestAnimationFrame(() => {
      imagePreviewScrollRef.current?.scrollTo({ top: 0, left: 0 })
    })
  }, [imagePreview?.title, imagePreview?.index, Boolean(imagePreview)])

  // 제품/상세 사진 확대: ← → Esc, + − 돋보기
  useEffect(() => {
    if (!imagePreview) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setImagePreview(null)
        return
      }
      if (e.key === "+" || e.key === "=") {
        e.preventDefault()
        setImagePreviewZoom((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100))
        return
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault()
        setImagePreviewZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))
        return
      }
      if (e.key === "0") {
        setImagePreviewZoom(imagePreview.title.includes("상세") ? 1.25 : 1)
        return
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
      setImagePreview((prev) => {
        if (!prev || prev.urls.length < 2) return prev
        const delta = e.key === "ArrowLeft" ? -1 : 1
        return {
          ...prev,
          index: (prev.index + delta + prev.urls.length) % prev.urls.length,
        }
      })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [imagePreview])

  // 자동화 모드: 유튜브 채널 연동 상태 로드 (localStorage) + OAuth 콜백 처리
  useEffect(() => {
    const key = "shopping_v2_factory_youtube_channel"
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem(key) : null
      if (saved) setYoutubeChannelName(saved)
      const savedId = typeof window !== "undefined" ? localStorage.getItem("shopping_v2_factory_youtube_client_id") : null
      const savedSecret = typeof window !== "undefined" ? localStorage.getItem("shopping_v2_factory_youtube_client_secret") : null
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
    if ((activeStep === "thumbnail" || activeStep === "preview") && thumbnailUrl && thumbnailCanvasRef.current) {
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

  // 유튜브 정보 단계 진입 시 메타데이터 자동 생성
  useEffect(() => {
    const generateMetadataOnEntry = async () => {
      if (activeStep === "metadata" && script.trim() && !youtubeTitle && !youtubeDescription && youtubeTags.length === 0) {
        const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined
        
        if (openaiApiKey) {
          console.log("[Shopping] 유튜브 정보 단계 진입, 메타데이터 자동 생성 시작")
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
            updateYoutubeTags(metadata.tags)
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

    generateMetadataOnEntry()
  }, [activeStep, script, productName, productDescription, youtubeTitle, youtubeDescription, youtubeTags])

  // 프로젝트 목록 로드
  const loadProjects = async () => {
    if (!userId) return
    
    setIsLoadingProjects(true)
    try {
      const result = await listAiShoppingProjects(userId)
      if (!result.ok) {
        console.error("프로젝트 목록 로드 실패:", result.error)
        alert(
          result.error ||
            "프로젝트 목록을 불러오는데 실패했습니다. Supabase 환경 변수(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)를 확인해주세요."
        )
        setProjects([])
        return
      }
      // 최신 작업 순으로 정렬 (updated_at 기준, 없으면 created_at 기준)
      const sortedProjects = [...result.projects].sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at).getTime()
        const dateB = new Date(b.updated_at || b.created_at).getTime()
        return dateB - dateA // 최신순 (내림차순)
      })
      setProjects(sortedProjects)
    } catch (error) {
      console.error("프로젝트 목록 로드 실패:", error)
      const msg =
        error instanceof Error && !/Server Components render|digest property/i.test(error.message)
          ? error.message
          : "프로젝트 목록을 불러오는데 실패했습니다. Vercel의 Supabase 환경 변수와 shopping_projects 테이블을 확인해주세요."
      alert(msg)
    } finally {
      setIsLoadingProjects(false)
    }
  }

  const resetWorkspaceToEmpty = () => {
    setKeywordAnalysis(null)
    setSelectedKeywordProduct(null)
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
    setSceneTtsTracks([])
    setScenes([])
    setScriptLines([])
    setVideoDuration(12)
    setSelectedVoiceId("elevenlabs-jB1Cifc2UQbq1gR3wnb0")
    setSubtitleStyle(DEFAULT_SHOPPING_SUBTITLE_STYLE)
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
    setTransitionDuration(0.04)
    setYoutubeTitle("")
    setYoutubeDescription("")
    updateYoutubeTags([])
    setThumbnailUrl("")
    setThumbnailHookingText({ line1: "", line2: "" })
    setThumbnailStudioDesign(null)
    setThumbnailImages([])
    setSelectedThumbnailIndex(0)
    setCoupangUrl("")
    setProductJson("")
    setProductPrice("")
    setProductDelivery("")
    setReviews([])
    setReviewImages([])
    setProductImages([])
    setDetailImages([])
    setDetailInsights(null)
    setReviewInsights(null)
    setCollectMode("collector")
    setManualReviewPaste("")
    setReviewListPage(1)
    setReviewCountText("")
    setStoryboardScenes([])
    setSceneCount(6)
    setVoiceRecordings({})
    setFreeImageUrls([])
    setUseImageZoomInsteadOfAiVideo(false)
    setImageZoomClipsPrepared(false)
    setActiveStep("keywordAnalysis")
    setError("")
  }

  /** blob:/data: TTS를 Supabase에 올려 영구 URL로 바꿉니다. 실패 시 원본 URL 유지. */
  const persistTtsAssetsForProject = async (
    projectId: string,
    sourceTtsUrl: string,
    sourceTracks: SceneTtsTrack[]
  ): Promise<{
    ttsAudioUrl: string
    sceneTtsTracks: SceneTtsTrack[]
    uploadedCount: number
    failedCount: number
    lastError?: string
  }> => {
    let uploadedCount = 0
    let failedCount = 0
    let lastError: string | undefined

    const uploadIfNeeded = async (url: string): Promise<string> => {
      const trimmed = (url || "").trim()
      if (!trimmed) return trimmed
      if (!trimmed.startsWith("blob:") && !trimmed.startsWith("data:")) return trimmed
      try {
        const response = await fetch(trimmed)
        const blob = await response.blob()
        if (!blob.size) throw new Error("빈 오디오")
        // Server Action으로 Blob을 넘기면 깨지는 경우가 많아 브라우저에서 직접 업로드
        const permanent = await uploadTtsBlobToStorage(blob, userId, projectId)
        uploadedCount += 1
        return permanent
      } catch (error) {
        failedCount += 1
        lastError = error instanceof Error ? error.message : String(error)
        console.error("[Shopping] TTS 업로드 실패:", error)
        return trimmed
      }
    }

    const nextTtsUrl = sourceTtsUrl ? await uploadIfNeeded(sourceTtsUrl) : ""
    const nextTracks: SceneTtsTrack[] = []
    for (const track of sourceTracks) {
      nextTracks.push({
        ...track,
        audioUrl: await uploadIfNeeded(track.audioUrl),
      })
    }

    return {
      ttsAudioUrl: nextTtsUrl,
      sceneTtsTracks: nextTracks,
      uploadedCount,
      failedCount,
      lastError,
    }
  }

  // 프로젝트 저장
  // - isNewEmptyProject: true → 빈 새 프로젝트 만들기(작업중 내용 초기화)
  // - currentProject 없음 + isNewEmptyProject: false → 현재 작업물을 새 프로젝트로 저장
  const saveProject = async (projectName?: string, isNewEmptyProject: boolean = false) => {
    if (!userId) {
      alert("로그인이 필요합니다.")
      return
    }

    let name: string
    if (isNewEmptyProject || !currentProject) {
      name = (newProjectName || projectName || "").trim()
      if (!name) {
        alert("프로젝트 이름을 입력해주세요.")
        return
      }
    } else {
      name = (projectName || currentProject.name || "").trim() || "새 프로젝트"
    }

    setIsSavingProject(true)
    try {
      // 1) 프로젝트 ID가 있으면 저장 전에 blob TTS를 서버에 올림
      let ttsAudioUrlToSave =
        ttsAudioUrl && ttsAudioUrl.trim() ? ttsAudioUrl.trim() : undefined
      let sceneTtsTracksToSave = sceneTtsTracks
      let ttsUploadSummary = {
        uploadedCount: 0,
        failedCount: 0,
        lastError: undefined as string | undefined,
      }

      if (currentProject?.id && !isNewEmptyProject) {
        const persisted = await persistTtsAssetsForProject(
          currentProject.id,
          ttsAudioUrl,
          sceneTtsTracks
        )
        ttsAudioUrlToSave = persisted.ttsAudioUrl || undefined
        sceneTtsTracksToSave = persisted.sceneTtsTracks
        ttsUploadSummary = {
          uploadedCount: persisted.uploadedCount,
          failedCount: persisted.failedCount,
          lastError: persisted.lastError,
        }
        // 화면 상태도 영구 URL로 갱신 (다시 저장해도 재업로드 안 함)
        if (persisted.uploadedCount > 0) {
          if (persisted.ttsAudioUrl && !persisted.ttsAudioUrl.startsWith("blob:")) {
            setTtsAudioUrl(persisted.ttsAudioUrl)
          }
          setSceneTtsTracks(persisted.sceneTtsTracks)
        }
      } else if (!currentProject && !isNewEmptyProject) {
        // 새 프로젝트: blob URL은 DB에 넣지 않음 (생성 후 아래에서 업로드)
        if (ttsAudioUrlToSave?.startsWith("blob:") || ttsAudioUrlToSave?.startsWith("data:")) {
          ttsAudioUrlToSave = undefined
        }
        sceneTtsTracksToSave = sceneTtsTracks.map((track) =>
          track.audioUrl.startsWith("blob:") || track.audioUrl.startsWith("data:")
            ? { ...track, audioUrl: "" }
            : track
        )
      }

      // blob이 그대로 남으면 나중에 복원이 불가하므로 저장에서 제외
      if (
        ttsAudioUrlToSave &&
        (ttsAudioUrlToSave.startsWith("blob:") || ttsAudioUrlToSave.startsWith("data:"))
      ) {
        ttsAudioUrlToSave =
          currentProject?.data?.ttsAudioUrl &&
          !currentProject.data.ttsAudioUrl.startsWith("blob:")
            ? currentProject.data.ttsAudioUrl
            : undefined
      }
      sceneTtsTracksToSave = sceneTtsTracksToSave
        .map((track) =>
          track.audioUrl.startsWith("blob:") || track.audioUrl.startsWith("data:")
            ? { ...track, audioUrl: "" }
            : track
        )
        .filter((track) => Boolean(track.audioUrl) || track.durationMs > 0)

      const storyboardScenesForSave = storyboardScenes.map((scene, index) => ({
        ...scene,
        imageUrl: imageUrls[index] || scene.imageUrl,
        videoUrl: convertedVideoUrls.get(index) || scene.videoUrl,
        selectedForVideo: Boolean(imageUrls[index]),
        imagePrompt: imagePrompts[index]?.prompt || scene.imagePrompt,
        pixabayKeyword: scene.pixabayKeyword || imagePrompts[index]?.pixabayKeyword,
      }))

      const projectData: ShoppingProjectData = {
        appVariant: "ver2",
        keywordAnalysis: keywordAnalysis || undefined,
        selectedKeywordProduct: selectedKeywordProduct
          ? {
              productId: selectedKeywordProduct.productId,
              productName: selectedKeywordProduct.productName,
              productPrice: selectedKeywordProduct.productPrice,
              productImage: selectedKeywordProduct.productImage,
              productUrl: selectedKeywordProduct.productUrl,
            }
          : undefined,
        productName: productName ?? undefined,
        productDescription: productDescription ?? undefined,
        productImage: productImage !== null ? productImage : undefined,
        productImages: productImages.length ? productImages : undefined,
        productPrice: productPrice || undefined,
        productDelivery: productDelivery || undefined,
        coupangUrl: coupangUrl || undefined,
        productJson: productJson || undefined,
        reviews: reviews.map((r, i) => {
          const meta = resolveReviewPageMeta(r, i)
          return {
            author: r.author,
            rating: r.rating,
            content: r.content,
            date: r.date,
            page: meta.page,
            indexOnPage: meta.indexOnPage,
            images: normalizeReviewImageUrls(r.images),
          }
        }),
        reviewImages: reviewImages.length ? reviewImages : undefined,
        detailImages: detailImages.length ? detailImages : undefined,
        detailInsights: detailInsights || undefined,
        reviewInsights: reviewInsights || undefined,
        reviewCountText: reviewCountText || undefined,
        videoDuration,
        targetScriptSeconds,
        sceneCount,
        selectedScriptTemplateId,
        visualFocus,
        scriptTitle: scriptTitle || undefined,
        script,
        editedScript,
        storyboardScenes: storyboardScenesForSave,
        selectedVoiceId,
        selectedTypecastVoiceId: selectedTypecastVoiceId || undefined,
        selectedTypecastEmotion: selectedTypecastEmotion || undefined,
        ttsAudioUrl: ttsAudioUrlToSave,
        sceneTtsTracks: sceneTtsTracksToSave.length ? sceneTtsTracksToSave : undefined,
        ttsDurationMs: sceneTtsTracksToSave.length
          ? sceneTtsTracksToSave.reduce((total, track) => total + track.durationMs, 0)
          : undefined,
        subtitleLines: scriptLines.length ? scriptLines : undefined,
        voiceRecordings,
        imageUrls,
        freeImageUrls,
        imagePrompts,
        convertedVideoUrls: Array.from(
          (() => {
            const map = new Map<number, string>()
            convertedVideoUrls.forEach((url, index) => {
              const trimmed = typeof url === "string" ? url.trim() : ""
              if (trimmed) map.set(index, trimmed)
            })
            storyboardScenes.forEach((scene, index) => {
              if (map.has(index)) return
              const trimmed = typeof scene.videoUrl === "string" ? scene.videoUrl.trim() : ""
              if (trimmed) map.set(index, trimmed)
            })
            return map
          })().entries()
        ).map(([index, url]) => ({
          index,
          videoUrl: url,
        })),
        useImageZoomInsteadOfAiVideo,
        imageZoomClipsPrepared,
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
        thumbnailStudioDesign: thumbnailStudioDesign || undefined,
        thumbnailImages,
        selectedThumbnailIndex,
        activeStep,
        completedSteps: [],
      }

      const formatSaveAlert = (extra?: string) => {
        const parts = ["프로젝트가 저장되었습니다."]
        if (ttsUploadSummary.uploadedCount > 0) {
          parts.push(`AI 음성 ${ttsUploadSummary.uploadedCount}개를 서버에 올렸습니다.`)
        }
        if (ttsUploadSummary.failedCount > 0) {
          parts.push("음성은 화면의 「컴퓨터에 저장」으로 받아 두세요.")
        }
        if (extra) parts.push(extra)
        return parts.join("\n")
      }

      if (currentProject && !isNewEmptyProject) {
        const updated = await updateShoppingProject(currentProject.id, {
          name,
          description: newProjectDescription || currentProject.description || undefined,
          data: projectData,
        })
        setCurrentProject(updated)
        if (ttsAudioUrlToSave && !ttsAudioUrlToSave.startsWith("blob:")) {
          setTtsAudioUrl(ttsAudioUrlToSave)
        }
        alert(formatSaveAlert())
      } else if (!isNewEmptyProject) {
        // 현재 작업물을 새 프로젝트로 저장 (내용 유지)
        const newProject = await createShoppingProject(
          userId,
          name,
          newProjectDescription || undefined,
          projectData
        )
        setCurrentProject(newProject)

        if (
          (ttsAudioUrl &&
            (ttsAudioUrl.startsWith("blob:") || ttsAudioUrl.startsWith("data:"))) ||
          sceneTtsTracks.some(
            (track) =>
              track.audioUrl.startsWith("blob:") || track.audioUrl.startsWith("data:")
          )
        ) {
          try {
            const persisted = await persistTtsAssetsForProject(
              newProject.id,
              ttsAudioUrl,
              sceneTtsTracks
            )
            ttsUploadSummary = {
              uploadedCount: persisted.uploadedCount,
              failedCount: persisted.failedCount,
              lastError: persisted.lastError,
            }
            const updated = await updateShoppingProject(newProject.id, {
              data: {
                ...projectData,
                ttsAudioUrl: persisted.ttsAudioUrl || undefined,
                sceneTtsTracks: persisted.sceneTtsTracks.length
                  ? persisted.sceneTtsTracks
                  : undefined,
                ttsDurationMs: persisted.sceneTtsTracks.length
                  ? persisted.sceneTtsTracks.reduce(
                      (total, track) => total + track.durationMs,
                      0
                    )
                  : undefined,
              },
            })
            setCurrentProject(updated)
            if (persisted.ttsAudioUrl) setTtsAudioUrl(persisted.ttsAudioUrl)
            setSceneTtsTracks(persisted.sceneTtsTracks)
          } catch (uploadError) {
            console.error("[Shopping] 새 프로젝트 오디오 업로드 실패:", uploadError)
            ttsUploadSummary.failedCount += 1
          }
        }

        setShowCreateProjectDialog(false)
        setNewProjectName("")
        setNewProjectDescription("")
        setCreateProjectMode("empty")
        setShowProjectList(false)
        alert(formatSaveAlert())
      } else {
        // 빈 새 프로젝트 만들기
        const qualityMode = newProjectQualityMode
        if (qualityMode === "high") {
          const emptyProjectData: ShoppingProjectData = {
            appVariant: "ver2",
            qualityMode: "high",
            hqAvatarId: "kr-f-20s-jiwoo",
            hqDurationSec: 15,
            videoDuration: 15,
            activeStep: "preview",
          }
          const newProject = await createShoppingProject(
            userId,
            name,
            newProjectDescription || undefined,
            emptyProjectData
          )
          setShowCreateProjectDialog(false)
          setNewProjectName("")
          setNewProjectDescription("")
          setNewProjectQualityMode("standard")
          setCreateProjectMode("empty")
          window.location.href = `/WingsAIStudioShotForm/ai-shopping/high-quality?projectId=${newProject.id}`
          return
        }

        resetWorkspaceToEmpty()
        const emptyProjectData: ShoppingProjectData = {
          appVariant: "ver2",
          qualityMode: "standard",
          activeStep: "keywordAnalysis",
        }
        const newProject = await createShoppingProject(
          userId,
          name,
          newProjectDescription || undefined,
          emptyProjectData
        )
        setCurrentProject(newProject)
        setShowCreateProjectDialog(false)
        setNewProjectName("")
        setNewProjectDescription("")
        setNewProjectQualityMode("standard")
        setCreateProjectMode("empty")
        setShowProjectList(false)
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

      // 고퀄리티 프로젝트는 전용 Recreate 화면으로 이동
      if (project.data?.qualityMode === "high") {
        window.location.href = `/WingsAIStudioShotForm/ai-shopping/high-quality?projectId=${project.id}`
        return
      }

      const data = project.data
      
      // 프로젝트 데이터 복원 (TTS 상태 포함)
      setKeywordAnalysis(data.keywordAnalysis || null)
      setSelectedKeywordProduct(
        data.selectedKeywordProduct
          ? { ...data.selectedKeywordProduct, rank: 0 }
          : null
      )
      if (data.productName) setProductName(data.productName)
      if (data.productDescription) setProductDescription(data.productDescription)
      if (data.productPrice) setProductPrice(data.productPrice)
      if (data.productDelivery) setProductDelivery(data.productDelivery)
      if (data.coupangUrl) setCoupangUrl(data.coupangUrl)
      if (data.productJson) setProductJson(data.productJson)
      if (data.reviews) {
        const loaded = data.reviews
          .map((r, i): ProductReviewItem | null => {
            const content = String(r.content || "").trim()
            if (!content) return null
            const meta = resolveReviewPageMeta(r, i)
            return {
              author: r.author,
              rating: r.rating,
              content,
              date: r.date,
              page: meta.page,
              indexOnPage: meta.indexOnPage,
              images: normalizeReviewImageUrls(r.images),
            }
          })
          .filter((r): r is ProductReviewItem => Boolean(r))
        setReviews(loaded)
        setReviewImages(
          normalizeReviewImageUrls([
            ...normalizeReviewImageUrls(data.reviewImages),
            ...loaded.flatMap((review) => review.images || []),
          ])
        )
        setReviewListPage(1)
      } else {
        setReviews([])
        setReviewImages(normalizeReviewImageUrls(data.reviewImages))
        setReviewListPage(1)
      }
      {
        let loadedDetails: string[] = []
        if (Array.isArray(data.detailImages) && data.detailImages.length > 0) {
          loadedDetails = data.detailImages.filter(
            (u) => typeof u === "string" && (u.startsWith("http") || u.startsWith("data:"))
          )
        } else if (data.productJson) {
          try {
            const parsed = JSON.parse(data.productJson)
            const fromJson = Array.isArray(parsed.detailImages) ? parsed.detailImages : []
            loadedDetails = fromJson.filter(
              (u: unknown): u is string =>
                typeof u === "string" && (u.startsWith("http") || u.startsWith("data:"))
            )
          } catch {
            loadedDetails = []
          }
        }
        setDetailImages(loadedDetails)

        let loadedProductPhotos: string[] = []
        if (Array.isArray(data.productImages) && data.productImages.length > 0) {
          loadedProductPhotos = data.productImages
            .filter(
              (u) => typeof u === "string" && (u.startsWith("http") || u.startsWith("data:"))
            )
            .slice(0, 2)
        } else if (typeof data.productImage === "string" && data.productImage) {
          loadedProductPhotos = [data.productImage]
        }
        setProductImages(loadedProductPhotos)

        const first = loadedProductPhotos[0] || null
        if (first) {
          setProductImage(first)
          const img = new Image()
          img.onload = () => {
            if (img.width > 0 && img.height > 0) {
              setProductImageAspectRatio(img.width / img.height)
            }
          }
          img.src = first
        } else {
          setProductImage(null)
          setProductImageAspectRatio(null)
        }

        if (loadedDetails.length > 0 || loadedProductPhotos.length > 0) {
          setCollectMode("collector")
        } else {
          setCollectMode("manual")
        }
      }
      if (data.detailInsights) setDetailInsights(data.detailInsights)
      else setDetailInsights(null)
      if (data.reviewInsights) setReviewInsights(data.reviewInsights)
      else setReviewInsights(null)
      if (data.reviewCountText) setReviewCountText(data.reviewCountText)
      if (data.videoDuration) setVideoDuration(data.videoDuration as 12 | 15 | 20 | 30)
      if (typeof data.targetScriptSeconds === "number" && data.targetScriptSeconds > 0) {
        setTargetScriptSeconds(Math.max(10, Math.min(60, data.targetScriptSeconds)))
      } else if (data.videoDuration) {
        setTargetScriptSeconds(data.videoDuration)
      }
      if (data.sceneCount) setSceneCount(data.sceneCount)
      if (data.selectedScriptTemplateId) setSelectedScriptTemplateId(data.selectedScriptTemplateId)
      if (data.visualFocus) setVisualFocus(normalizeVisualFocus(data.visualFocus))
      if (data.scriptTitle) setScriptTitle(data.scriptTitle)
      if (data.script) setScript(data.script)
      if (data.editedScript) setEditedScript(data.editedScript)
      // 스토리보드: 저장된 것이 있으면 복원, 없고 imagePrompts만 있으면 마이그레이션
      if (data.storyboardScenes && data.storyboardScenes.length > 0) {
        const migratedScenes = data.storyboardScenes.map((scene, index) => ({
          ...scene,
          imageUrl: scene.imageUrl || data.imageUrls?.[index],
          videoUrl:
            scene.videoUrl ||
            data.convertedVideoUrls?.find((item) => item.index === index)?.videoUrl,
          selectedForVideo:
            scene.selectedForVideo ??
            Boolean(scene.imageUrl || data.imageUrls?.[index]),
        }))
        setStoryboardScenes(migratedScenes)
        setSceneCount(migratedScenes.length)
        setSelectedImageSlots(
          new Set(
            migratedScenes
              .map((scene, index) => (scene.selectedForVideo && scene.imageUrl ? index : -1))
              .filter((index) => index >= 0)
          )
        )
      } else if (data.imagePrompts && data.imagePrompts.length > 0) {
        const migratedScenes = data.imagePrompts.map((p, idx) => ({
            id: `scene-${idx}`,
            title: p.type,
            narration: p.scriptText,
            imagePrompt: p.prompt,
            imageUrl: data.imageUrls?.[idx],
            videoUrl: data.convertedVideoUrls?.find((item) => item.index === idx)?.videoUrl,
            selectedForVideo: Boolean(data.imageUrls?.[idx]),
          }))
        setStoryboardScenes(migratedScenes)
        setSceneCount(migratedScenes.length)
      }
      if (data.voiceRecordings) setVoiceRecordings(data.voiceRecordings)
      if (data.freeImageUrls) setFreeImageUrls(data.freeImageUrls)
      if (data.selectedVoiceId) {
        setSelectedVoiceId(
          data.selectedVoiceId.startsWith("ttsmaker-")
            ? DEFAULT_VOICE_ID
            : restorableVoiceId(data.selectedVoiceId)
        )
      }
      if (data.selectedTypecastVoiceId) setSelectedTypecastVoiceId(data.selectedTypecastVoiceId)
      if (data.selectedTypecastEmotion) setSelectedTypecastEmotion(data.selectedTypecastEmotion)
      // TTS 오디오 URL 복원 (빈 문자열이 아닌 경우에만)
      setTtsAudioUrl(data.ttsAudioUrl && data.ttsAudioUrl.trim() ? data.ttsAudioUrl : "")
      setSceneTtsTracks(data.sceneTtsTracks || [])
      setScriptLines(data.subtitleLines || [])
      if (data.imageUrls) setImageUrls(data.imageUrls)
      if (data.imagePrompts) {
        setImagePrompts(data.imagePrompts)
        setPromptsGenerated(data.imagePrompts.length > 0)
      }
      {
        // convertedVideoUrls 와 storyboard.videoUrl 둘 다에서 복원 (한쪽만 저장된 경우 대비)
        const videoMap = new Map<number, string>()
        data.convertedVideoUrls?.forEach(({ index, videoUrl }) => {
          const trimmed = typeof videoUrl === "string" ? videoUrl.trim() : ""
          if (trimmed) videoMap.set(index, trimmed)
        })
        data.storyboardScenes?.forEach((scene, index) => {
          if (videoMap.has(index)) return
          const trimmed = typeof scene.videoUrl === "string" ? scene.videoUrl.trim() : ""
          if (trimmed) videoMap.set(index, trimmed)
        })
        setConvertedVideoUrls(videoMap)
      }
      if (data.videoUrl) setVideoUrl(data.videoUrl)
      if (data.subtitleStyle) setSubtitleStyle(normalizeShoppingSubtitleStyle(data.subtitleStyle))
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
      if (typeof data.useImageZoomInsteadOfAiVideo === "boolean") {
        setUseImageZoomInsteadOfAiVideo(data.useImageZoomInsteadOfAiVideo)
      }
      if (typeof data.imageZoomClipsPrepared === "boolean") {
        setImageZoomClipsPrepared(data.imageZoomClipsPrepared)
      } else if (data.useImageZoomInsteadOfAiVideo) {
        // 구 저장분: 줌 모드 + 영상이 있으면 준비된 것으로 간주
        setImageZoomClipsPrepared(
          Array.isArray(data.convertedVideoUrls) && data.convertedVideoUrls.length > 0
        )
      } else {
        setImageZoomClipsPrepared(false)
      }
      if (data.transitionDuration !== undefined) setTransitionDuration(0.04)
      if (data.youtubeTitle) setYoutubeTitle(data.youtubeTitle)
      if (data.youtubeDescription) setYoutubeDescription(data.youtubeDescription)
      if (data.youtubeTags) updateYoutubeTags(data.youtubeTags)
      if (data.thumbnailUrl) setThumbnailUrl(data.thumbnailUrl)
      if (data.thumbnailHookingText) setThumbnailHookingText(data.thumbnailHookingText)
      setThumbnailStudioDesign(data.thumbnailStudioDesign || null)
      if (data.thumbnailImages) setThumbnailImages(data.thumbnailImages)
      if (data.selectedThumbnailIndex !== undefined) setSelectedThumbnailIndex(data.selectedThumbnailIndex)
      setActiveStep(migrateVer2ActiveStep(data.activeStep, !!(data.script || data.editedScript)))

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

  /** 대표 productImage 동기화 (다음 단계 썸네일·이미지 생성용) */
  const syncPrimaryProductImage = (urls: string[]) => {
    const first = urls[0] || null
    setProductImage(first)
    setProductImageFile(null)
    if (!first) {
      setProductImageAspectRatio(null)
      return
    }
    const img = new Image()
    img.onload = () => {
      if (img.width > 0 && img.height > 0) {
        setProductImageAspectRatio(img.width / img.height)
      }
    }
    img.src = first
  }

  const readImageFileAsDataUrl = (file: File): Promise<string | null> => {
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드 가능합니다.")
      return Promise.resolve(null)
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("이미지 크기는 10MB 이하여야 합니다.")
      return Promise.resolve(null)
    }
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    })
  }

  // 상세페이지 목록에 추가 (수집기 모드)
  const processImageFile = (file: File) => {
    void readImageFileAsDataUrl(file).then((imageUrl) => {
      if (!imageUrl) return
      setProductImageFile(file)
      setDetailImages((prev) => [...prev, imageUrl])
    })
  }

  // 제품 사진에 추가 (직접 입력 / 다음 단계용)
  const processProductPhotoFile = (file: File) => {
    void readImageFileAsDataUrl(file).then((imageUrl) => {
      if (!imageUrl) return
      setProductImageFile(file)
      setProductImages((prev) => {
        const next = [...prev, imageUrl].slice(0, 6)
        syncPrimaryProductImage(next)
        return next
      })
    })
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    Array.from(files).forEach((file) => processImageFile(file))
    e.target.value = ""
  }

  const handleProductPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    Array.from(files).forEach((file) => processProductPhotoFile(file))
    e.target.value = ""
  }

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
    const files = e.dataTransfer.files
    if (!files?.length) return
    Array.from(files).forEach((file) => processImageFile(file))
  }

  const handleProductPhotoDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (!files?.length) return
    Array.from(files).forEach((file) => processProductPhotoFile(file))
  }

  /** 상세페이지·제품사진 전체 제거 */
  const handleRemoveImage = () => {
    setDetailImages([])
    setProductImages([])
    setProductImage(null)
    setProductImageFile(null)
    setProductImageAspectRatio(null)
  }

  const handleRemoveProductImageAt = (index: number) => {
    setProductImages((prev) => {
      const next = prev.filter((_, i) => i !== index)
      setProductImage(next[0] || null)
      if (!next[0]) setProductImageAspectRatio(null)
      return next
    })
  }

  /** 상세페이지 한 장 제거 */
  const handleRemoveDetailImageAt = (index: number) => {
    setDetailImages((prev) => prev.filter((_, i) => i !== index))
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

  const syncVideoDurationFromSeconds = (seconds: number) => {
    const opts = [12, 15, 20, 30] as const
    let best: 12 | 15 | 20 | 30 = 30
    for (const o of opts) {
      if (Math.abs(o - seconds) < Math.abs(best - seconds)) best = o
    }
    setVideoDuration(best)
  }

  // 대본 생성 (템플릿 + 목표 길이 → 장면별 IMAGE/MOTION)
  const handleGenerateScript = async () => {
    if (!productName.trim()) {
      alert("제품명을 입력해주세요.")
      return
    }

    const openaiApiKey =
      typeof window !== "undefined"
        ? localStorage.getItem("shotform_openai_api_key") || undefined
        : undefined

    if (!openaiApiKey) {
      alert(
        "OpenAI API 키가 필요합니다. 메인 화면의 설정(톱니바퀴 아이콘)에서 API 키를 입력해주세요."
      )
      return
    }

    setIsGeneratingScript(true)
    setError("")
    setEditingSceneId(null)

    try {
      const insightsText = formatInsightsForScript(reviewInsights)
      const detailText = formatDetailInsightsForScript(detailInsights)
      const reviewSamples = reviews
        .map((r) => r.content.trim())
        .filter((c) => c.length >= 4)
        .slice(0, 10)

      const productImageUrls = [
        ...productImages,
        productImage || "",
      ].filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u))

      const res = await fetch("/api/shotform/shopping/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openaiApiKey,
          templateId: selectedScriptTemplateId,
          productName: productName.trim(),
          targetSeconds: targetScriptSeconds,
          detailInsightsText: detailText || undefined,
          reviewInsightsText: insightsText || undefined,
          reviewSamples,
          productPrice: productPrice || undefined,
          productDelivery: productDelivery || undefined,
          extraNotes: productDescription.trim() || undefined,
          productImageUrls: productImageUrls.slice(0, 2),
          visualFocus,
        }),
      })

      const json = (await res.json().catch(() => ({}))) as {
        title?: string
        spokenScript?: string
        scenes?: Array<{
          id: string
          narration: string
          imagePrompt?: string
          motionPrompt?: string
        }>
        error?: string
      }

      if (!res.ok || !json.spokenScript) {
        throw new Error(json.error || "대본 생성에 실패했습니다.")
      }

      const spoken = json.spokenScript.trim()
      setScript(spoken)
      setEditedScript(spoken)
      setScriptTitle((json.title || "").trim())
      syncVideoDurationFromSeconds(targetScriptSeconds)

      const scenes: StoryboardScene[] = (json.scenes || []).map((s, i) => ({
        id: s.id || `m${i + 1}s1`,
        title: `M${i + 1}, S1`,
        narration: (s.narration || "").trim(),
        imagePrompt: (s.imagePrompt || "").trim(),
        motionPrompt: (s.motionPrompt || "").trim(),
      }))
      const readyScenes = scenes.filter((s) => s.narration)
      setStoryboardScenes(readyScenes)
      setSceneCount(readyScenes.length)
      setImageUrls(readyScenes.map(() => ""))
      setImagePrompts(imagePromptItemsFromScenes(readyScenes))
      setConvertedVideoUrls(new Map())
      setSelectedImageSlots(new Set())

      // 파트 분석은 보조 (실패해도 무시)
      try {
        setIsAnalyzingScript(true)
        const parts = await analyzeScriptParts(spoken, openaiApiKey)
        setScriptParts(parts)
      } catch {
        setScriptParts([])
      } finally {
        setIsAnalyzingScript(false)
      }
    } catch (error) {
      console.error("대본 생성 실패:", error)
      setError(
        `대본 생성에 실패했습니다: ${
          error instanceof Error ? error.message : "알 수 없는 오류"
        }`
      )
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
      
      // 영상 끝까지 재생
      setBgmEndTime(BGM_FULL_LENGTH_SEC)
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
    
    // 영상 끝까지 재생
    setBgmEndTime(BGM_FULL_LENGTH_SEC)
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
      updateYoutubeTags(metadata.tags)
    } catch (error) {
      console.error("메타데이터 생성 실패:", error)
      alert(`메타데이터 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      setIsGeneratingMetadata(false)
    }
  }

  const copyYoutubeField = async (
    field: "title" | "description" | "tags",
    text: string
  ) => {
    const value = text.trim()
    if (!value) {
      alert(
        field === "title"
          ? "복사할 제목이 없습니다."
          : field === "description"
            ? "복사할 설명이 없습니다."
            : "복사할 태그가 없습니다."
      )
      return
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        const ta = document.createElement("textarea")
        ta.value = value
        ta.style.position = "fixed"
        ta.style.left = "-9999px"
        document.body.appendChild(ta)
        ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
      }
      if (field === "title") {
        setCopiedTitle(true)
        window.setTimeout(() => setCopiedTitle(false), 1600)
      } else if (field === "description") {
        setCopiedDescription(true)
        window.setTimeout(() => setCopiedDescription(false), 1600)
      } else {
        setCopiedTags(true)
        window.setTimeout(() => setCopiedTags(false), 1600)
      }
    } catch {
      alert("클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.")
    }
  }

  const fetchTypecastVoices = async () => {
    setIsLoadingTypecastVoices(true)
    try {
      const typecastApiKey =
        typeof window !== "undefined"
          ? (
              localStorage.getItem("shotform_typecast_api_key") ||
              localStorage.getItem("typecast_api_key") ||
              ""
            ).trim()
          : ""
      if (!typecastApiKey) {
        alert("타입캐스트 API 키가 필요합니다. 설정에서 typecast_api_key를 입력해주세요.")
        return
      }
      const response = await fetch(
        `/api/typecast-voices?apiKey=${encodeURIComponent(typecastApiKey)}`
      )
      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean
        voices?: Array<{
          voice_id: string
          name: string
          name_en?: string
          styles?: string[]
          thumbnail_image_url?: string
          gender?: string
          age?: string
          use_cases?: string[]
        }>
        error?: string
      }
      if (!response.ok || data.success === false) {
        throw new Error(data.error || "타입캐스트 목록을 가져오지 못했습니다.")
      }
      const voices = (data.voices || []).map((v) =>
        enrichTypecastVoice({
          voice_id: v.voice_id,
          name: v.name,
          name_en: v.name_en,
          styles: v.styles,
          thumbnail_image_url: v.thumbnail_image_url,
          gender: v.gender,
          age: v.age,
          use_cases: v.use_cases,
        })
      )
      setTypecastVoices(voices)
      if (voices.length > 0 && !selectedTypecastVoiceId) {
        setSelectedTypecastVoiceId(voices[0].voice_id)
        setSelectedVoiceId(`typecast-${voices[0].voice_id}`)
        const styles = voices[0].styles
        if (styles?.length) {
          setSelectedTypecastEmotion(
            styles.includes("normal") ? "normal" : styles[0]
          )
        }
      }
    } catch (error) {
      console.error("타입캐스트 음성 목록 실패:", error)
      alert(
        `타입캐스트 목록 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`
      )
    } finally {
      setIsLoadingTypecastVoices(false)
    }
  }

  /** 엔진별 API 허용 범위로 배속 clamp */
  const resolveTtsSpeed = (providerHint?: string) => {
    const raw = Number(ttsSpeed)
    const s = Number.isFinite(raw) ? raw : 1
    if (providerHint === "elevenlabs" || providerHint?.startsWith("elevenlabs")) {
      return Math.min(1.5, Math.max(0.8, Math.round(s * 10) / 10))
    }
    if (providerHint === "supertonic" || providerHint?.startsWith("supertonic")) {
      return Math.min(2, Math.max(0.7, Math.round(s * 100) / 100))
    }
    // Typecast / TTSMaker
    return Math.min(2, Math.max(0.5, Math.round(s * 10) / 10))
  }

  // 목소리 미리듣기 함수
  const handlePreviewVoice = async (voiceId: string) => {
    setPreviewingVoiceId(voiceId)
    
    try {
      let response: Response
      
      if (voiceId?.startsWith("supertonic-")) {
        // 로컬 Supertonic 3
        const bare = voiceId.replace("supertonic-", "")
        response = await fetchSupertonicTts({
          text: "안녕하세요 윙스에이아이 테스트입니다",
          voiceId: bare,
          lang: "ko",
          speed: resolveTtsSpeed("supertonic"),
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
            speed: resolveTtsSpeed("ttsmaker"),
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
            speed: resolveTtsSpeed("elevenlabs"),
          }),
        })
      } else if (voiceId?.startsWith("typecast-")) {
        const cleanVoiceId = voiceId.replace("typecast-", "")
        const typecastApiKey =
          typeof window !== "undefined"
            ? (
                localStorage.getItem("shotform_typecast_api_key") ||
                localStorage.getItem("typecast_api_key") ||
                ""
              ).trim()
            : ""
        if (!typecastApiKey) {
          alert("타입캐스트 API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
          setPreviewingVoiceId(null)
          return
        }
        response = await fetch("/api/typecast-tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: "안녕하세요",
            voiceId: cleanVoiceId,
            apiKey: typecastApiKey,
            emotion: selectedTypecastEmotion || "normal",
            speed: resolveTtsSpeed("typecast"),
          }),
        })
      } else if (voiceId?.startsWith("adam-")) {
        response = await fetchAdamTts({
          text: "안녕하세요",
          tempo: resolveTtsSpeed("adam"),
        })
      } else {
        alert(
          isRetiredSupertoneVoiceId(voiceId)
            ? RETIRED_SUPERTONE_MESSAGE
            : "지원하지 않는 보이스입니다. Supertonic 3 / ElevenLabs / 타입캐스트 / 아담을 선택해주세요."
        )
        setPreviewingVoiceId(null)
        return
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
        audio.playbackRate = 1 // 배속은 TTS 합성에 이미 반영됨
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
        audio.playbackRate = 1
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

    if (isRetiredSupertoneVoiceId(selectedVoiceId)) {
      alert(RETIRED_SUPERTONE_MESSAGE)
      return
    }

    if (
      !selectedVoiceId ||
      selectedVoiceId.startsWith("ttsmaker-") ||
      (!selectedVoiceId.startsWith("supertonic-") &&
        !selectedVoiceId.startsWith("elevenlabs-") &&
        !selectedVoiceId.startsWith("typecast-") &&
        !selectedVoiceId.startsWith("adam-") &&
        !selectedVoiceId.startsWith("gemini-"))
    ) {
      alert("Gemini / Supertonic 3 / ElevenLabs / 타입캐스트 / 아담 보이스를 선택해주세요.")
      setSelectedVoiceId("elevenlabs-jB1Cifc2UQbq1gR3wnb0")
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
    setSceneTtsTracks([])

    setIsGeneratingTTS(true)
    setError("")

    try {
      const sceneEntries = storyboardScenes
        .map((scene, sceneIndex) => ({
          sceneId: scene.id || `scene-${sceneIndex + 1}`,
          sceneIndex,
          text: scene.narration.trim(),
        }))
        .filter((scene) => scene.text.length > 0)
      if (sceneEntries.length === 0) {
        sceneEntries.push({ sceneId: "scene-1", sceneIndex: 0, text: script.trim() })
      }

      setTtsProgress({ current: 0, total: sceneEntries.length })
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const generatedBuffers: AudioBuffer[] = []
      const generatedTracks: SceneTtsTrack[] = []

      for (const [trackIndex, sceneEntry] of sceneEntries.entries()) {
        const ttsText = sceneEntry.text
        console.log(
          `[Shopping] 장면 ${sceneEntry.sceneIndex + 1} TTS 생성 중 (${trackIndex + 1}/${sceneEntries.length})`
        )
      
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
            speed: resolveTtsSpeed("ttsmaker"),
            pitch: pitch,
            apiKey: ttsmakerApiKey,
          }),
        })
      } else if (selectedVoiceId?.startsWith("supertonic-")) {
        const voiceId = selectedVoiceId.replace("supertonic-", "")
        response = await fetchSupertonicTts({
          text: ttsText,
          voiceId,
          lang: "ko",
          speed: resolveTtsSpeed("supertonic"),
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
            speed: resolveTtsSpeed("elevenlabs"),
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
          alert("타입캐스트 API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
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
            emotion: selectedTypecastEmotion || "normal",
            speed: resolveTtsSpeed("typecast"),
          }),
        })
      } else if (selectedVoiceId?.startsWith("adam-")) {
        response = await fetchAdamTts({
          text: ttsText,
          tempo: resolveTtsSpeed("adam"),
        })
      } else if (selectedVoiceId?.startsWith("gemini-")) {
        response = await fetch("/api/ai-shopping/gemini-tts", {
          method: "POST",
          // 배포 서버는 Gemini 키를 파일에 저장하지 않으므로 수강생 본인 키를 요청마다 보낸다 (geminiApiKey()가 이 헤더를 먼저 읽음)
          headers: { "Content-Type": "application/json", "x-wings-gemini-key": localStorage.getItem("shotform_gemini_api_key")?.trim() || "" },
          body: JSON.stringify({
            text: ttsText,
            voiceId: selectedVoiceId.replace("gemini-", ""),
            speed: resolveTtsSpeed("gemini"),
          }),
        })
      } else {
        alert("지원하지 않는 보이스입니다.")
        setIsGeneratingTTS(false)
        return
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
      const arrayBuffer = await audioBlob.arrayBuffer()
      const decodedAudioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      const { buffer: audioBuffer, trimStartMs } = trimAudioBufferEdgeSilence(
        audioContext,
        decodedAudioBuffer
      )
      
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
      
      const actualAudioDuration = originalDuration
      const tempAudioUrl = URL.createObjectURL(processedBlob)
      let permanentAudioUrl = tempAudioUrl
      try {
        if (userId && currentProject?.id) {
          permanentAudioUrl = await uploadTtsBlobToStorage(
            processedBlob,
            userId,
            currentProject.id
          )
        }
      } catch (uploadError) {
        console.warn(`[Shopping] 장면 ${sceneEntry.sceneIndex + 1} TTS 업로드 실패:`, uploadError)
      }

      // 각 장면 오디오 안에서 의미 단위 자막의 로컬 시간을 계산한다.
      let lines = buildCharacterAlignedScriptLines([ttsText], data.alignment || {})
      if (lines && trimStartMs > 0) {
        const trimmedDurationMs = actualAudioDuration * 1000
        lines = lines
          .map((line) => ({
            ...line,
            startTime: Math.max(0, line.startTime - trimStartMs),
            endTime: Math.min(trimmedDurationMs, Math.max(0, line.endTime - trimStartMs)),
          }))
          .filter((line) => line.endTime > line.startTime)
      }

      if (!lines?.length) {
        const openaiApiKey =
          typeof window !== "undefined"
            ? localStorage.getItem("shotform_openai_api_key") || ""
            : ""
        if (openaiApiKey) {
          try {
            const alignmentForm = new FormData()
            alignmentForm.append("audio", processedBlob, "tts.wav")
            alignmentForm.append("apiKey", openaiApiKey)
            alignmentForm.append("script", ttsText)
            const alignmentResponse = await fetch("/api/shotform/align-subtitles", {
              method: "POST",
              body: alignmentForm,
            })
            const alignmentData = (await alignmentResponse.json().catch(() => ({}))) as {
              words?: AlignedWord[]
              error?: string
            }
            if (alignmentResponse.ok && alignmentData.words?.length) {
              lines = buildWordAlignedScriptLines([ttsText], alignmentData.words)
            } else {
              console.warn(`[Shopping] 장면 ${sceneEntry.sceneIndex + 1} Whisper 정렬 실패:`, alignmentData.error)
            }
          } catch (alignmentError) {
            console.warn(`[Shopping] 장면 ${sceneEntry.sceneIndex + 1} Whisper 요청 실패:`, alignmentError)
          }
        }
      }

      if (!lines?.length) {
        lines = buildTimedScriptLines([ttsText], actualAudioDuration)
      }

        generatedBuffers.push(audioBuffer)
        generatedTracks.push({
          sceneId: sceneEntry.sceneId,
          sceneIndex: sceneEntry.sceneIndex,
          text: ttsText,
          audioUrl: permanentAudioUrl,
          durationMs: Math.round(actualAudioDuration * 1000),
          subtitles: lines.map((line, index) => ({
            id: index + 1,
            text: line.text,
            startTime: line.startTime,
            endTime: line.endTime,
            alignmentSource: line.alignmentSource,
          })),
        })
        setTtsProgress({ current: trackIndex + 1, total: sceneEntries.length })
      }

      // 장면별 오디오를 순서대로 이어 붙여 미리보기/렌더의 단일 마스터 클럭으로 사용한다.
      const sampleRate = audioContext.sampleRate
      const channelCount = Math.max(...generatedBuffers.map((buffer) => buffer.numberOfChannels))
      const outputLengths = generatedBuffers.map((buffer) =>
        Math.max(1, Math.round(buffer.duration * sampleRate))
      )
      const mergedBuffer = audioContext.createBuffer(
        channelCount,
        outputLengths.reduce((total, length) => total + length, 0),
        sampleRate
      )
      let sampleOffset = 0
      generatedBuffers.forEach((buffer, bufferIndex) => {
        const outputLength = outputLengths[bufferIndex]!
        for (let channel = 0; channel < channelCount; channel += 1) {
          const source = buffer.getChannelData(Math.min(channel, buffer.numberOfChannels - 1))
          const target = mergedBuffer.getChannelData(channel)
          for (let sample = 0; sample < outputLength; sample += 1) {
            const sourceIndex = Math.min(
              source.length - 1,
              Math.floor((sample / sampleRate) * buffer.sampleRate)
            )
            target[sampleOffset + sample] = source[sourceIndex] || 0
          }
        }
        sampleOffset += outputLength
      })

      const mergedBlob = new Blob([audioBufferToWav(mergedBuffer)], { type: "audio/wav" })
      const mergedTempUrl = URL.createObjectURL(mergedBlob)
      let mergedAudioUrl = mergedTempUrl
      if (userId && currentProject?.id) {
        try {
          mergedAudioUrl = await uploadTtsBlobToStorage(
            mergedBlob,
            userId,
            currentProject.id
          )
        } catch (uploadError) {
          console.warn("[Shopping] 결합 TTS 업로드 실패:", uploadError)
        }
      }

      let globalOffsetMs = 0
      const globalLines: ScriptLine[] = []
      generatedTracks.forEach((track) => {
        track.subtitles.forEach((subtitle) => {
          globalLines.push({
            id: globalLines.length + 1,
            text: subtitle.text,
            startTime: globalOffsetMs + subtitle.startTime,
            endTime: globalOffsetMs + subtitle.endTime,
            sceneIndex: track.sceneIndex,
            alignmentSource: subtitle.alignmentSource,
          })
        })
        globalOffsetMs += track.durationMs
      })
      // 자막이 끊기거나 겹치지 않게: 각 줄은 다음 줄이 시작할 때까지 보이고, 마지막 줄은 음성 끝까지
      globalLines.forEach((line, i) => {
        const next = globalLines[i + 1]
        line.endTime = next ? Math.max(line.startTime + 1, next.startTime) : Math.max(line.endTime, globalOffsetMs)
      })

      setScenes(sceneEntries.map((scene) => scene.text))
      setSceneTtsTracks(generatedTracks)
      setScriptLines(globalLines)
      setTtsAudioUrl(mergedAudioUrl)
      await audioContext.close().catch(() => undefined)
      alert(
        `${generatedTracks.length}개 장면의 TTS 생성과 결합이 완료되었습니다. (총 ${(globalOffsetMs / 1000).toFixed(1)}초)`
      )
    } catch (error) {
      console.error("TTS 생성 실패:", error)
      setError(`TTS 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      setIsGeneratingTTS(false)
    }
  }

  const imagePromptItemsFromScenes = (items: StoryboardScene[]): ImagePromptItem[] =>
    items.map((scene, index) => ({
      type: scene.title || `장면 ${index + 1}`,
      prompt: scene.imagePrompt?.trim() || "",
      description: scene.title || `M${index + 1}, S1`,
      scriptText: scene.narration,
      pixabayKeyword: scene.pixabayKeyword || "",
    }))

  const fallbackPixabayKeyword = (scene: StoryboardScene) => {
    const englishWords = (scene.imagePrompt || "")
      .match(/[A-Za-z][A-Za-z-]*/g)
      ?.filter((word) => !["the", "and", "with", "from", "into", "photo", "image"].includes(word.toLowerCase()))
      .slice(0, 4)
    return englishWords?.join(" ") || productName.trim() || "product lifestyle"
  }

  const searchPixabayForScene = async (sceneIndex: number, keywordOverride?: string) => {
    const scene = storyboardScenes[sceneIndex]
    if (!scene) return
    const keyword = (keywordOverride || scene.pixabayKeyword || fallbackPixabayKeyword(scene)).trim()
    if (!keyword) return
    const apiKey =
      typeof window !== "undefined"
        ? localStorage.getItem("shotform_pixabay_api_key") || undefined
        : undefined
    setScenePixabay((prev) => ({
      ...prev,
      [scene.id]: { keyword, hits: prev[scene.id]?.hits || [], total: 0, loading: true },
    }))
    try {
      const result = await searchPixabayImages(keyword, apiKey, {
        perPage: 16,
        orientation: "vertical",
      })
      setScenePixabay((prev) => ({
        ...prev,
        [scene.id]: { keyword, hits: result.hits, total: result.total, loading: false },
      }))
      setStoryboardScenes((prev) =>
        prev.map((item) => (item.id === scene.id ? { ...item, pixabayKeyword: keyword } : item))
      )
    } catch (searchError) {
      setScenePixabay((prev) => ({
        ...prev,
        [scene.id]: {
          keyword,
          hits: prev[scene.id]?.hits || [],
          total: 0,
          loading: false,
          error: searchError instanceof Error ? searchError.message : "Pixabay 검색 실패",
        },
      }))
    }
  }

  const getPixabaySuggestionsForScene = async (
    sceneIndex: number
  ): Promise<PixabayKeywordSuggestion[]> => {
    const scene = storyboardScenes[sceneIndex]
    if (!scene) return []
    const openaiApiKey =
      typeof window !== "undefined"
        ? localStorage.getItem("shotform_openai_api_key") || undefined
        : undefined
    return generatePixabayKeywordSuggestions(scene.narration, productName, openaiApiKey)
  }

  // 대본에서 만든 장면·프롬프트를 그대로 AI이미지 단계로 전달
  const handleGoToImageGeneration = () => {
    if (!script.trim()) {
      alert("대본이 생성되지 않았습니다.")
      return
    }
    if (storyboardScenes.length === 0) {
      alert("대본 장면이 없습니다. 대본을 다시 생성해주세요.")
      return
    }
    setActiveStep("images")
    const prompts = imagePromptItemsFromScenes(storyboardScenes)
    setImagePrompts(prompts)
    setPromptsGenerated(prompts.some((item) => item.prompt.trim()))
    setSceneCount(storyboardScenes.length)
    setImageUrls(storyboardScenes.map((scene, index) => scene.imageUrl || imageUrls[index] || ""))
    setSelectedImageSlots(
      new Set(
        storyboardScenes
          .map((scene, index) => (scene.selectedForVideo || scene.imageUrl || imageUrls[index] ? index : -1))
          .filter((index) => index >= 0)
      )
    )
    setIsConvertingToVideo(new Map())
  }

  /** 장면 이미지 변경 시 스토리보드와 후속 영상 상태를 함께 동기화 */
  const setSceneImageAt = (
    index: number,
    url: string,
    source: "ai" | "external" = "external"
  ) => {
    setImageUrls((prev) => {
      const next = [...prev]
      while (next.length < storyboardScenes.length) next.push("")
      next[index] = url
      return next
    })
    const sceneId = storyboardScenes[index]?.id
    if (sceneId) {
      setStoryboardScenes((prev) =>
        prev.map((scene) =>
          scene.id === sceneId
            ? {
                ...scene,
                imageUrl: url,
                videoUrl: undefined,
                selectedForVideo: true,
                aiImageUrl:
                  source === "ai"
                    ? url
                    : scene.aiImageUrl ||
                      (!scene.freeImageUrl && scene.imageUrl ? scene.imageUrl : undefined),
                freeImageUrl: source === "ai" ? undefined : scene.freeImageUrl,
              }
            : scene
        )
      )
    }
    setSelectedImageSlots((prev) => {
      const next = new Set(prev)
      next.add(index)
      return next
    })
    setConvertedVideoUrls((prev) => {
      const next = new Map(prev)
      next.delete(index)
      return next
    })
  }

  const restoreSceneAiImage = (index: number) => {
    const scene = storyboardScenes[index]
    if (!scene?.aiImageUrl) return
    setSceneImageAt(index, scene.aiImageUrl, "ai")
  }

  const handleSceneImageUpload = (index: number, file: File | null) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드할 수 있습니다.")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : ""
      if (!dataUrl) return
      setSceneImageAt(index, dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const openPixabayPicker = (slot: number | null = null) => {
    setPixabayTargetSlot(slot)
    setPixabayError("")
    if (!pixabayQuery.trim() && productName.trim()) {
      setPixabayQuery(productName.trim())
    }
    setShowPixabayDialog(true)
  }

  const clearSceneImageAt = (index: number) => {
    setImageUrls((prev) => {
      const next = [...prev]
      while (next.length <= index) next.push("")
      next[index] = ""
      return next
    })
    const sceneId = storyboardScenes[index]?.id
    if (sceneId) {
      setStoryboardScenes((prev) =>
        prev.map((scene) =>
          scene.id === sceneId ? { ...scene, imageUrl: undefined, videoUrl: undefined } : scene
        )
      )
    }
    setConvertedVideoUrls((prev) => {
      const next = new Map(prev)
      next.delete(index)
      return next
    })
    setSelectedImageSlots((prev) => {
      const next = new Set(prev)
      next.delete(index)
      return next
    })
  }

  const clearAllSceneImages = () => {
    if (!confirm("모든 장면 이미지를 삭제할까요?")) return
    setImageUrls(storyboardScenes.map(() => ""))
    setStoryboardScenes((prev) =>
      prev.map((scene) => ({ ...scene, imageUrl: undefined, videoUrl: undefined }))
    )
    setConvertedVideoUrls(new Map())
    setSelectedImageSlots(new Set())
  }

  const saveImagePromptAt = (index: number, prompt: string) => {
    setImagePrompts((prev) => {
      const next = [...prev]
      while (next.length <= index) {
        next.push({
          type: storyboardScenes[next.length]?.title || `장면 ${next.length + 1}`,
          prompt: "",
          description: "",
          scriptText: "",
          pixabayKeyword: "",
        })
      }
      const cur = next[index] || {
        type: storyboardScenes[index]?.title || `장면 ${index + 1}`,
        prompt: "",
        description: "",
        scriptText: "",
        pixabayKeyword: "",
      }
      next[index] = { ...cur, prompt }
      return next
    })
    const sceneId = storyboardScenes[index]?.id
    if (sceneId) {
      setStoryboardScenes((prev) =>
        prev.map((scene) => (scene.id === sceneId ? { ...scene, imagePrompt: prompt } : scene))
      )
    }
    if (prompt.trim()) setPromptsGenerated(true)
  }

  const handleGenerateMissingImages = async () => {
    const missing = storyboardScenes.map((_, index) => index).filter((i) => !imageUrls[i])
    if (missing.length === 0) return
    let prompts = imagePrompts
    if (!promptsGenerated || prompts.length === 0) {
      const generated = await handleGenerateImagePrompts()
      if (!generated?.length) return
      prompts = generated
    }
    setIsGeneratingVideo(true)
    try {
      await generateSceneImagesInOrder(missing, prompts, findPersonReferenceImage(prompts, prompts.length))
    } finally {
      setBulkImageGenerationIndex(null)
      setIsGeneratingVideo(false)
    }
  }

  const handleSearchPixabay = async () => {
    const apiKey =
      typeof window !== "undefined" ? localStorage.getItem("shotform_pixabay_api_key") || undefined : undefined
    if (!apiKey) {
      alert("Pixabay API 키가 필요합니다. 메인 화면의 설정(톱니바퀴)에서 Pixabay API 키를 입력해주세요.")
      return
    }
    if (!pixabayQuery.trim()) {
      setPixabayError("검색어를 입력해주세요.")
      return
    }

    setIsSearchingPixabay(true)
    setPixabayError("")
    try {
      const result = await searchPixabayImages(pixabayQuery.trim(), apiKey, {
        perPage: 24,
        orientation: "vertical",
      })
      setPixabayHits(result.hits)
      setPixabayTotal(result.total)
      if (result.hits.length === 0) {
        setPixabayError("검색 결과가 없습니다. 다른 검색어를 시도해보세요.")
      }
    } catch (error) {
      console.error("Pixabay 검색 실패:", error)
      setPixabayError(error instanceof Error ? error.message : "Pixabay 검색에 실패했습니다.")
      setPixabayHits([])
      setPixabayTotal(0)
    } finally {
      setIsSearchingPixabay(false)
    }
  }

  const handleSelectPixabayImage = (hit: PixabayImageHit) => {
    const url = hit.largeImageURL || hit.webformatURL
    if (!url) return

    if (
      pixabayTargetSlot !== null &&
      pixabayTargetSlot >= 0 &&
      pixabayTargetSlot < storyboardScenes.length
    ) {
      setSceneImageAt(pixabayTargetSlot, url)
    } else {
      setFreeImageUrls((prev) => [...prev, url])
      setImageUrls((prev) => {
        const next = [...prev]
        // 빈 슬롯이 있으면 거기에, 없으면 뒤에 추가
        const emptyIdx = next.findIndex((u) => !u)
        if (emptyIdx >= 0) {
          next[emptyIdx] = url
          return next
        }
        if (next.length < storyboardScenes.length) {
          next.push(url)
          return next
        }
        return [...next, url]
      })
    }
    setShowPixabayDialog(false)
  }

  const setSceneVideoAt = (index: number, url: string) => {
    setConvertedVideoUrls((prev) => {
      const next = new Map(prev)
      next.set(index, url)
      return next
    })
    setSelectedVideoSlots((prev) => {
      const next = new Set(prev)
      next.add(index)
      return next
    })
    const sceneId = storyboardScenes[index]?.id
    if (sceneId) {
      setStoryboardScenes((prev) =>
        prev.map((scene) => (scene.id === sceneId ? { ...scene, videoUrl: url } : scene))
      )
    }
  }

  const handleSceneVideoUpload = (index: number, file: File | null) => {
    if (!file) return
    if (!file.type.startsWith("video/")) {
      alert("동영상 파일만 업로드할 수 있습니다.")
      return
    }
    const objectUrl = URL.createObjectURL(file)
    setSceneVideoAt(index, objectUrl)
    // blob: 주소는 새로고침하면 사라진다 → 바로 저장소에 올려 영구 주소로 바꾼다 (실패하면 지금 화면에서만 쓰임)
    void uploadBlobToGcsShopping(file, `scene_upload_${index}_${Date.now()}`, file.type || "video/mp4")
      .then((remote) => {
        if (remote) setSceneVideoAt(index, remote)
      })
      .catch((err) => console.warn("[Shopping] 업로드 영상 저장 실패:", err))
  }

  const openPixabayVideoPicker = (slot: number | null = null) => {
    setPixabayVideoTargetSlot(slot ?? selectedVideoSceneIndex)
    setPixabayVideoError("")
    if (!pixabayVideoQuery.trim() && productName.trim()) {
      setPixabayVideoQuery(productName.trim())
    }
    setShowPixabayVideoDialog(true)
  }

  const handleSearchPixabayVideos = async () => {
    const apiKey =
      typeof window !== "undefined" ? localStorage.getItem("shotform_pixabay_api_key") || undefined : undefined
    if (!apiKey) {
      alert("Pixabay API 키가 필요합니다. 메인 화면의 설정(톱니바퀴)에서 Pixabay API 키를 입력해주세요.")
      return
    }
    if (!pixabayVideoQuery.trim()) {
      setPixabayVideoError("검색어를 입력해주세요.")
      return
    }

    setIsSearchingPixabayVideo(true)
    setPixabayVideoError("")
    try {
      const result = await searchPixabayVideos(pixabayVideoQuery.trim(), apiKey, { perPage: 20 })
      setPixabayVideoHits(result.hits)
      setPixabayVideoTotal(result.total)
      if (result.hits.length === 0) {
        setPixabayVideoError("검색 결과가 없습니다. 다른 검색어를 시도해보세요.")
      }
    } catch (error) {
      console.error("Pixabay 동영상 검색 실패:", error)
      setPixabayVideoError(error instanceof Error ? error.message : "Pixabay 동영상 검색에 실패했습니다.")
      setPixabayVideoHits([])
      setPixabayVideoTotal(0)
    } finally {
      setIsSearchingPixabayVideo(false)
    }
  }

  const handleSelectPixabayVideo = (hit: PixabayVideoHit) => {
    if (!hit.videoURL) return
    const slot =
      pixabayVideoTargetSlot !== null &&
      pixabayVideoTargetSlot >= 0 &&
      pixabayVideoTargetSlot < storyboardScenes.length
        ? pixabayVideoTargetSlot
        : selectedVideoSceneIndex
    setSceneVideoAt(slot, hit.videoURL)
    setShowPixabayVideoDialog(false)
  }

  const handleDownloadSelectedVideos = async () => {
    const slots = Array.from(selectedVideoSlots).sort()
    if (slots.length === 0) {
      alert("다운로드할 영상을 선택해주세요.")
      return
    }
    for (const index of slots) {
      const url = convertedVideoUrls.get(index)
      if (!url) continue
      try {
        const res = await fetch(url)
        const blob = await res.blob()
        const a = document.createElement("a")
        a.href = URL.createObjectURL(blob)
        a.download = `scene-M${index + 1}-video.mp4`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(a.href)
      } catch (error) {
        console.error(`장면 ${index + 1} 다운로드 실패:`, error)
        // CORS 등으로 blob 실패 시 새 탭으로 열기
        window.open(url, "_blank")
      }
    }
  }

  const handleDeleteSceneVideo = (index: number) => {
    setConvertedVideoUrls((prev) => {
      const next = new Map(prev)
      next.delete(index)
      return next
    })
    setSelectedVideoSlots((prev) => {
      const next = new Set(prev)
      next.delete(index)
      return next
    })
    const sceneId = storyboardScenes[index]?.id
    if (sceneId) {
      setStoryboardScenes((prev) =>
        prev.map((scene) => (scene.id === sceneId ? { ...scene, videoUrl: undefined } : scene))
      )
    }
  }

  // 이미지 프롬프트 생성 함수
  const handleGenerateImagePrompts = async (): Promise<ImagePromptItem[] | null> => {
    if (!script.trim()) {
      alert("대본이 생성되지 않았습니다.")
      return null
    }

    const storyboardPrompts = imagePromptItemsFromScenes(storyboardScenes)
    if (
      storyboardPrompts.length > 0 &&
      storyboardPrompts.every((item) => item.prompt.trim())
    ) {
      const ready = storyboardPrompts.map((item, index) => ({
        ...item,
        pixabayKeyword:
          item.pixabayKeyword || fallbackPixabayKeyword(storyboardScenes[index]),
      }))
      setImagePrompts(ready)
      setPromptsGenerated(true)
      setStoryboardScenes((prev) =>
        prev.map((scene, index) => ({
          ...scene,
          pixabayKeyword: ready[index]?.pixabayKeyword || scene.pixabayKeyword,
        }))
      )
      return ready
    }

    const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined

    if (!openaiApiKey) {
      alert("OpenAI API 키가 필요합니다. 메인 화면의 설정(톱니바퀴 아이콘)에서 API 키를 입력해주세요.")
      return null
    }

    setIsGeneratingPrompts(true)
    setError("")

    try {
      // 이미지를 base64로 변환 (있는 경우)
      let imageBase64: string | undefined = undefined
      if (productImage) {
        imageBase64 = productImage
      }

      // 구 프로젝트에 장면 프롬프트가 없을 때만 대본을 재분석
      const prompts = await generateImagePromptsFromScript(
        script, // 대본 전체 전달
        productName,
        productDescription || "",
        imageBase64,
        openaiApiKey,
        visualFocus
      )
      
      const dynamicPrompts = storyboardScenes.map((scene, index) => {
        const generated = prompts[index]
        return {
          type: scene.title || generated?.type || `장면 ${index + 1}`,
          prompt: scene.imagePrompt || generated?.prompt || "",
          description: generated?.description || scene.title || "",
          scriptText: scene.narration,
          pixabayKeyword:
            generated?.pixabayKeyword || scene.pixabayKeyword || fallbackPixabayKeyword(scene),
        }
      })
      setImagePrompts(dynamicPrompts)
      setPromptsGenerated(true)
      setStoryboardScenes((prev) =>
        prev.map((scene, index) => ({
          ...scene,
          imagePrompt: dynamicPrompts[index]?.prompt || scene.imagePrompt,
          pixabayKeyword: dynamicPrompts[index]?.pixabayKeyword || scene.pixabayKeyword,
        }))
      )
      return dynamicPrompts
    } catch (error) {
      console.error("프롬프트 생성 실패:", error)
      setError(`프롬프트 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
      return null
    } finally {
      setIsGeneratingPrompts(false)
    }
  }

  /** 수집한 제품 사진(최대 3장)을 Replicate 참고 이미지로 준비 */
  const getProductImageInputs = async (): Promise<string[]> => {
    const candidates = [...productImages, productImage || ""].filter(
      (url): url is string => typeof url === "string" && url.trim().length > 0
    )
    const unique: string[] = []
    const seen = new Set<string>()
    for (const url of candidates) {
      const key = url.trim()
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(key)
      if (unique.length >= 3) break
    }

    const resolved: string[] = []
    for (const url of unique) {
      if (!url.startsWith("blob:")) {
        resolved.push(url)
        continue
      }
      const response = await fetch(url)
      if (!response.ok) continue
      const blob = await response.blob()
      const dataUrl = await new Promise<string | null>((resolve) => {
        const reader = new FileReader()
        reader.onload = () =>
          resolve(typeof reader.result === "string" ? reader.result : null)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(blob)
      })
      if (dataUrl) resolved.push(dataUrl)
    }
    return resolved
  }

  /** @deprecated 단일 참고 — 내부적으로 다중 참고의 첫 장 사용 */
  const getProductImageInput = async (): Promise<string | undefined> => {
    const refs = await getProductImageInputs()
    return refs[0]
  }

  /** 생성 결과의 흰색 레터박스를 제거하고 실제 9:16 풀블리드 이미지로 정규화 */
  const normalizeGeneratedImageToPortrait = async (sourceUrl: string): Promise<string> => {
    try {
      const response = await fetch(sourceUrl)
      if (!response.ok) return sourceUrl
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      try {
        const image = new Image()
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve()
          image.onerror = () => reject(new Error("생성 이미지 로드 실패"))
          image.src = objectUrl
        })

        const scanCanvas = document.createElement("canvas")
        scanCanvas.width = image.naturalWidth
        scanCanvas.height = image.naturalHeight
        const scanContext = scanCanvas.getContext("2d", { willReadFrequently: true })
        if (!scanContext) return sourceUrl
        scanContext.drawImage(image, 0, 0)

        const isBlankRow = (y: number) => {
          const pixels = scanContext.getImageData(0, y, scanCanvas.width, 1).data
          const sampleStep = Math.max(1, Math.floor(scanCanvas.width / 180))
          let sampled = 0
          let blank = 0
          for (let x = 0; x < scanCanvas.width; x += sampleStep) {
            const offset = x * 4
            const r = pixels[offset]
            const g = pixels[offset + 1]
            const b = pixels[offset + 2]
            const a = pixels[offset + 3]
            sampled++
            if (a < 20 || (r > 242 && g > 242 && b > 242)) blank++
          }
          return sampled > 0 && blank / sampled >= 0.94
        }

        let cropTop = 0
        let cropBottom = scanCanvas.height - 1
        while (cropTop < scanCanvas.height * 0.3 && isBlankRow(cropTop)) cropTop++
        while (
          cropBottom > scanCanvas.height * 0.7 &&
          isBlankRow(cropBottom)
        ) {
          cropBottom--
        }

        const sourceHeight = Math.max(1, cropBottom - cropTop + 1)
        const sourceWidth = scanCanvas.width
        const outputWidth = 1080
        const outputHeight = 1920
        const targetRatio = outputWidth / outputHeight
        const sourceRatio = sourceWidth / sourceHeight

        let sx = 0
        let sy = cropTop
        let sw = sourceWidth
        let sh = sourceHeight
        if (sourceRatio > targetRatio) {
          sw = sourceHeight * targetRatio
          sx = (sourceWidth - sw) / 2
        } else if (sourceRatio < targetRatio) {
          sh = sourceWidth / targetRatio
          sy = cropTop + (sourceHeight - sh) / 2
        }

        const outputCanvas = document.createElement("canvas")
        outputCanvas.width = outputWidth
        outputCanvas.height = outputHeight
        const outputContext = outputCanvas.getContext("2d")
        if (!outputContext) return sourceUrl
        outputContext.drawImage(image, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight)
        return outputCanvas.toDataURL("image/webp", 0.92)
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    } catch (normalizeError) {
      console.warn("[Shopping] 9:16 이미지 후처리 실패, 원본 사용:", normalizeError)
      return sourceUrl
    }
  }

  const handleGenerateImage = async (
    promptsOverride?: ImagePromptItem[]
  ) => {
    if (!script.trim()) {
      alert("대본이 생성되지 않았습니다.")
      return
    }

    const promptsToUse = promptsOverride?.length ? promptsOverride : imagePrompts
    if (!promptsToUse.length) {
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
    setGenerationProgress({ current: 0, total: promptsToUse.length })

    try {
      const imageRefs = await getProductImageInputs()
      if (imageRefs.length === 0) {
        alert(
          "제품 참고 이미지가 없습니다. 제품 소싱 단계에서 쿠팡 상품 사진을 먼저 수집해주세요. 참고 이미지가 없으면 다른 상품처럼 생성될 수 있습니다."
        )
        return
      }
      const openaiApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined
      
      const imageUrls = await generateImage(
        script,
        productName,
        replicateApiKey,
        imageRefs,
        productDescription,
        openaiApiKey,
        promptsToUse,
        "9:16",
        imageModel,
        visualFocus
      )
      
      setImageUrls(imageUrls)
      setStoryboardScenes((prev) =>
        prev.map((scene, index) => ({ ...scene, imageUrl: imageUrls[index] || scene.imageUrl }))
      )
      setSelectedImageSlots(new Set(imageUrls.map((_, i) => i).filter((i) => !!imageUrls[i])))
      setGenerationProgress({ current: imageUrls.length, total: promptsToUse.length })
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
  /** beforeIndex 이전 장면 중 인물이 나온 첫 이미지 — 이후 장면의 동일 인물 레퍼런스 */
  const findPersonReferenceImage = (prompts: ImagePromptItem[], beforeIndex: number) => {
    for (let i = 0; i < beforeIndex; i++) {
      const url = imageUrls[i] || storyboardScenes[i]?.imageUrl
      if (url && promptLikelyShowsPerson(prompts[i]?.prompt || "")) return url
    }
    return undefined
  }

  /**
   * 장면을 순서대로 생성하면서 첫 인물 컷을 다음 장면의 인물 레퍼런스로 넘긴다.
   * (루프 안에서는 imageUrls state가 갱신되지 않으므로 직접 들고 다닌다)
   */
  const generateSceneImagesInOrder = async (
    indices: number[],
    prompts: ImagePromptItem[],
    initialPersonRef?: string
  ) => {
    let personRef = initialPersonRef
    for (const index of indices) {
      setBulkImageGenerationIndex(index)
      setSelectedImageSceneIndex(index)
      const url = await handleRegenerateSingleImage(index, prompts, personRef)
      if (!personRef && url && promptLikelyShowsPerson(prompts[index]?.prompt || "")) {
        personRef = url
      }
    }
  }

  const handleRegenerateSingleImage = async (
    index: number,
    promptsOverride?: ImagePromptItem[],
    personRefOverride?: string
  ): Promise<string | undefined> => {
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

    const promptsToUse = promptsOverride?.length ? promptsOverride : imagePrompts
    if (!promptsToUse.length) {
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

    const sceneName = storyboardScenes[index]?.title || `장면 ${index + 1}`
    
    try {
      setError("")
      
      console.log(`[Shopping] 🖼️ ${sceneName} 재생성 시작`)
      
      const imageRefs = await getProductImageInputs()
      if (imageRefs.length === 0) {
        throw new Error(
          "제품 참고 이미지가 없습니다. 제품 소싱에서 원본 상품 사진을 수집한 뒤 다시 시도해주세요."
        )
      }

      // 해당 인덱스의 프롬프트로 이미지 재생성
      const prompt = promptsToUse[index]
      if (!prompt?.prompt) {
        throw new Error(`${sceneName} 프롬프트가 없습니다.`)
      }
      
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

      // 장면 프롬프트보다 제품 정체성 보존을 뒤에 붙여 우선순위 강화
      finalPrompt = `${finalPrompt}

PRODUCT LOCK: Use the attached reference product only. Keep identical color, cut, materials, and all logos/lettering/prints on the garment or product surface. Do not invent a different product or graphic.`

      // 이전 장면 AI 이미지 중 인물이 나온 컷을 캐릭터 레퍼런스로 (제품 유지와 동일)
      const characterRef = personRefOverride ?? findPersonReferenceImage(promptsToUse, index)

      const generatedImageUrl = await generateImageWithNanobanana(
        finalPrompt,
        productName,
        imageRefs,
        replicateApiKey,
        index, // sceneIndex
        productDescription,
        "9:16",
        imageModel,
        "product-recompose",
        typeof window !== "undefined"
          ? localStorage.getItem("shotform_openai_api_key") || undefined
          : undefined,
        characterRef,
        visualFocus
      )
      const imageUrl = await normalizeGeneratedImageToPortrait(generatedImageUrl)
      
      console.log(`[Shopping] ✅ ${sceneName} 재생성 완료:`, imageUrl)
      
      setSceneImageAt(index, imageUrl, "ai")
      return imageUrl
    } catch (error) {
      console.error(`[Shopping] ❌ ${sceneName} 재생성 실패:`, error)
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

  const handleGenerateThumbnailPhrases = async () => {
    if (!productName.trim()) {
      alert("제품명이 필요합니다.")
      return
    }
    const gptApiKey =
      typeof window !== "undefined" ? localStorage.getItem("shotform_openai_api_key") || undefined : undefined
    if (!gptApiKey) {
      alert("OpenAI API 키가 필요합니다. 설정에서 API 키를 입력해주세요.")
      return
    }
    setIsGeneratingThumbnailPhrases(true)
    setError("")
    try {
      const stack = THUMBNAIL_TEMPLATE_STACKS.find((s) => s.id === thumbnailTemplateStackId)
      const style = THUMBNAIL_STYLE_VARIANTS.find((s) => s.id === thumbnailStyleVariantId)
      const items = await generateThumbnailPhraseAndTitles({
        productName,
        script,
        productDescription,
        count: 8,
        apiKey: gptApiKey,
        templateFocus: stack?.thumbnailFocus,
        styleInstructions: style?.instructions,
      })
      setThumbnailPhraseCandidates(items)
      if (items[0]) {
        setSelectedThumbnailPhraseIndex(0)
        setThumbnailHookingText({ line1: items[0].line1, line2: items[0].line2 })
        setThumbnailVideoTitleDraft(items[0].videoTitle)
        if (!youtubeTitle) setYoutubeTitle(items[0].videoTitle)
      }
    } catch (error) {
      console.error("문구/제목 추천 실패:", error)
      setError(error instanceof Error ? error.message : "문구/제목 추천 실패")
    } finally {
      setIsGeneratingThumbnailPhrases(false)
    }
  }

  // 썸네일 생성 (AI) — ver1과 동일: 후킹 문구 + nano-banana-pro
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
      // blob URL을 포함한 제품 이미지를 Replicate가 읽을 수 있는 data URI/공개 URL로 정규화
      const imageBase64 = await getProductImageInput()

      // 1. 이미 고른 seed가 있으면 사용, 없으면 후킹 문구 생성
      let hookingText = thumbnailHookingText
      if (!hookingText.line1?.trim() || !hookingText.line2?.trim()) {
        hookingText = await generateThumbnailHookingText(productName, gptApiKey)
        setThumbnailHookingText(hookingText)
      }

      // 2. 제품 이미지 확인
      if (!imageBase64) {
        throw new Error("제품 이미지가 필요합니다.")
      }

      // 3. 나노바나나로 썸네일 생성 (제품 이미지 + 텍스트 포함 + 템플릿/스타일 힌트)
      const stack = THUMBNAIL_TEMPLATE_STACKS.find((s) => s.id === thumbnailTemplateStackId)
      const style = THUMBNAIL_STYLE_VARIANTS.find((s) => s.id === thumbnailStyleVariantId)
      const thumbnail = await generateShortsThumbnail(
        productName,
        replicateApiKey,
        imageBase64,
        hookingText,
        {
          templateFocus: stack?.thumbnailFocus,
          styleInstructions: style?.instructions,
        }
      )
      
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

  const handleSeparateAssetDownload = async (id: string) => {
    const base = productName || "ai-shopping"
    setSeparateAssetBusy(id)
    try {
      if (id === "srt") {
        const srt = buildSrtFromTimedCues(
          scriptLines.map((line) => ({
            text: line.text,
            start: line.startTime,
            end: line.endTime,
          }))
        )
        if (!srt.trim()) {
          throw new Error("자막 타이밍이 없습니다. 음성·미리보기를 먼저 생성해 주세요.")
        }
        downloadTextFile(srt, assetFilename(base, "subtitles", "srt"))
        return
      }
      if (id === "thumbnail") {
        const selected = thumbnailImages[selectedThumbnailIndex]
        if (selected?.url) {
          await downloadUrlAsFile(selected.url, assetFilename(base, "thumbnail", "png"))
          return
        }
        if (thumbnailUrl) {
          await downloadUrlAsFile(thumbnailUrl, assetFilename(base, "thumbnail", "png"))
          return
        }
        handleDownloadThumbnail()
        return
      }
      if (id === "tts") {
        await downloadTtsUrl(ttsAudioUrl, base)
        return
      }
      if (id === "video") {
        const entries: Array<{ url: string; name: string }> = []
        convertedVideoUrls.forEach((url, index) => {
          if (!url) return
          const ext = guessExtFromUrlOrType(url, undefined, "mp4")
          entries.push({ url, name: `scene_${String(index + 1).padStart(2, "0")}.${ext}` })
        })
        if (!entries.length) {
          throw new Error("장면 영상이 없습니다. 영상 단계에서 클립을 먼저 만들어 주세요.")
        }
        await downloadUrlsAsZip(entries, assetFilename(base, "videos", "zip"))
        return
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "개별 파일 저장에 실패했습니다.")
    } finally {
      setSeparateAssetBusy(null)
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
                
                const sceneStart = videoStartTimes[currentVideoIndex]
                const sceneEnd =
                  currentVideoIndex < videoStartTimes.length - 1
                    ? videoStartTimes[currentVideoIndex + 1]
                    : sceneStart + videoDurations[currentVideoIndex]
                ctx.globalAlpha = getSceneBlinkOpacity(
                  adjustedElapsed,
                  sceneStart,
                  sceneEnd,
                  currentVideoIndex,
                  videoDurations.length,
                  transitionDuration
                )
                ctx.drawImage(currentVideo, 0, 0, videoWidth, videoHeight, drawX, drawY, drawWidth, drawHeight)
                ctx.globalAlpha = 1
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
            const phraseIndex = getSubtitlePhraseIndex(phrases, timeInLine, lineDuration)
            const textToShow = phrases[phraseIndex] || currentLine.text
            const subtitleY = canvas.height * 0.38
            
            // 자막 텍스트 (배경 없음, 검정 테두리)
            let previewFontSize = 100
            ctx.font = `bold ${previewFontSize}px 'Noto Sans KR', sans-serif`
            const maxPreviewSubtitleWidth = canvas.width * 0.88
            const measuredPreviewWidth = ctx.measureText(textToShow).width
            if (measuredPreviewWidth > maxPreviewSubtitleWidth) {
              previewFontSize *= maxPreviewSubtitleWidth / measuredPreviewWidth
              ctx.font = `bold ${previewFontSize}px 'Noto Sans KR', sans-serif`
            }
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
    // 타임라인은 sceneTtsTracks/storyboard 기준으로 보이지만,
    // 미리보기는 convertedVideoUrls + ttsAudioUrl만 보면 어긋날 수 있어 둘 다 합친다.
    const videoMap = new Map<number, string>()
    convertedVideoUrls.forEach((url, index) => {
      const trimmed = typeof url === "string" ? url.trim() : ""
      if (trimmed) videoMap.set(index, trimmed)
    })
    storyboardScenes.forEach((scene, index) => {
      if (videoMap.has(index)) return
      const trimmed = typeof scene.videoUrl === "string" ? scene.videoUrl.trim() : ""
      if (trimmed) videoMap.set(index, trimmed)
    })
    if (videoMap.size !== convertedVideoUrls.size) {
      setConvertedVideoUrls(new Map(videoMap))
    } else {
      let needsSync = false
      videoMap.forEach((url, index) => {
        if (convertedVideoUrls.get(index) !== url) needsSync = true
      })
      if (needsSync) setConvertedVideoUrls(new Map(videoMap))
    }

    const pipelineSceneIndices =
      sceneTtsTracks.length > 0
        ? sceneTtsTracks.map((track) => track.sceneIndex)
        : videoMap.size > 0
          ? Array.from(videoMap.keys()).sort((a, b) => a - b)
          : getPipelineSceneIndices()

    const missingVideoIndices = pipelineSceneIndices.filter((index) => !videoMap.has(index))

    let effectiveTtsUrl = (ttsAudioUrl || "").trim()
    if (!effectiveTtsUrl && sceneTtsTracks.length > 0) {
      const orderedTrackUrls = pipelineSceneIndices
        .map(
          (sceneIndex) =>
            sceneTtsTracks.find((track) => track.sceneIndex === sceneIndex)?.audioUrl?.trim() || ""
        )
        .filter(Boolean)
      if (orderedTrackUrls.length === pipelineSceneIndices.length && orderedTrackUrls.length > 0) {
        try {
          effectiveTtsUrl = await mergeSceneTtsAudioUrls(orderedTrackUrls)
          setTtsAudioUrl(effectiveTtsUrl)
        } catch (mergeError) {
          console.warn("[Shopping] 장면 TTS 병합 실패:", mergeError)
        }
      }
    }

    if (pipelineSceneIndices.length === 0) {
      alert("미리보기에 사용할 장면이 없습니다.")
      return
    }
    if (missingVideoIndices.length > 0) {
      alert(
        `다음 장면의 영상이 없습니다: ${missingVideoIndices.map((index) => index + 1).join(", ")}\nAI영상 단계에서 영상을 준비해주세요.`
      )
      return
    }
    if (!effectiveTtsUrl) {
      const hasGhostTracks = sceneTtsTracks.some(
        (track) => track.durationMs > 0 && !(track.audioUrl || "").trim()
      )
      alert(
        hasGhostTracks
          ? "타임라인에는 TTS 길이가 남아 있지만 실제 오디오 파일이 없습니다.\nAI 음성 단계에서 TTS를 다시 생성해주세요."
          : "TTS 음성이 없습니다. AI 음성 단계에서 음성을 생성하거나 업로드해주세요."
      )
      return
    }

    setIsGeneratingPreview(true)
    setError("")
    
    try {
      console.log("[Shopping] 미리보기 생성 시작 (롱폼 방식)")

      // 오디오 로드 (blob URL인지 확인)
      let audioUrl: string
      if (effectiveTtsUrl.startsWith("blob:")) {
        // blob URL이면 직접 사용
        audioUrl = effectiveTtsUrl
      } else {
        // 일반 URL이면 fetch로 가져오기
        const audioResponse = await fetch(effectiveTtsUrl)
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

      let previewScriptLines = scriptLines
      if (sceneTtsTracks.length > 0) {
        let trackOffsetMs = 0
        const trackLines: ScriptLine[] = []
        sceneTtsTracks.forEach((track) => {
          track.subtitles.forEach((subtitle) => {
            trackLines.push({
              id: trackLines.length + 1,
              text: subtitle.text,
              startTime: trackOffsetMs + subtitle.startTime,
              endTime: trackOffsetMs + subtitle.endTime,
              sceneIndex: track.sceneIndex,
              alignmentSource: subtitle.alignmentSource,
            })
          })
          trackOffsetMs += track.durationMs
        })
        previewScriptLines = trackLines
      }
      const sceneNarrations = storyboardScenes
        .map((scene) => scene.narration.trim())
        .filter(Boolean)
      const hasPreciseAlignment = previewScriptLines.some(
        (line) => line.alignmentSource === "provider" || line.alignmentSource === "whisper"
      )

      if (!hasPreciseAlignment && sceneNarrations.length > 0) {
        const openaiApiKey =
          typeof window !== "undefined"
            ? localStorage.getItem("shotform_openai_api_key") || ""
            : ""
        if (openaiApiKey) {
          try {
            const audioResponse = await fetch(audioUrl)
            if (!audioResponse.ok) throw new Error("TTS 오디오를 읽지 못했습니다.")
            const alignmentForm = new FormData()
            alignmentForm.append("audio", await audioResponse.blob(), "tts.wav")
            alignmentForm.append("apiKey", openaiApiKey)
            alignmentForm.append("script", script)
            const alignmentResponse = await fetch("/api/shotform/align-subtitles", {
              method: "POST",
              body: alignmentForm,
            })
            const alignmentData = (await alignmentResponse.json().catch(() => ({}))) as {
              words?: AlignedWord[]
              error?: string
            }
            if (alignmentResponse.ok && alignmentData.words?.length) {
              const alignedLines = buildWordAlignedScriptLines(sceneNarrations, alignmentData.words)
              if (alignedLines) previewScriptLines = alignedLines
            } else {
              console.warn("[Shopping] 미리보기 자막 정렬 실패:", alignmentData.error)
            }
          } catch (alignmentError) {
            console.warn("[Shopping] 미리보기 자막 정렬 요청 실패:", alignmentError)
          }
        }
      }

      if (previewScriptLines.length === 0) {
        previewScriptLines = buildTimedScriptLines(sceneNarrations, actualAudioDuration)
      }
      setScriptLines(previewScriptLines)
      console.log(`[Shopping] 자막 타임라인 준비 완료 (${previewScriptLines.length}개 의미 단위)`)

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

      // 선택된 장면 영상을 대본 순서대로 로드
      const videoElements: HTMLVideoElement[] = []

      const requestedSceneDurations = pipelineSceneIndices.map((sceneIndex) => {
        const exactTrack = sceneTtsTracks.find((track) => track.sceneIndex === sceneIndex)
        if (exactTrack?.durationMs) return exactTrack.durationMs / 1000
        return (
          getSceneTtsDurationSeconds(
            previewScriptLines,
            storyboardScenes[sceneIndex]?.narration || "",
            sceneIndex
          ) || actualAudioDuration / Math.max(1, pipelineSceneIndices.length)
        )
      })
      const requestedDurationTotal = requestedSceneDurations.reduce(
        (sum, duration) => sum + duration,
        0
      )
      const hasExactSceneTracks = pipelineSceneIndices.every((sceneIndex) =>
        sceneTtsTracks.some((track) => track.sceneIndex === sceneIndex && track.durationMs > 0)
      )
      const scenePlaybackDurations = hasExactSceneTracks
        ? requestedSceneDurations
        : requestedSceneDurations.map(
            (duration) => (actualAudioDuration * duration) / Math.max(0.001, requestedDurationTotal)
          )
      const videoDurations = [...scenePlaybackDurations]

      for (let ordinal = 0; ordinal < pipelineSceneIndices.length; ordinal++) {
        const sceneIndex = pipelineSceneIndices[ordinal]
        const videoUrl = videoMap.get(sceneIndex) || convertedVideoUrls.get(sceneIndex)
        if (!videoUrl) {
          throw new Error(`영상 ${sceneIndex + 1}이 준비되지 않았습니다.`)
        }
        const durationPerVideo = scenePlaybackDurations[ordinal]
        
        const video = document.createElement("video")
        // blob: URL은 same-origin이라 crossOrigin 불필요; 외부 URL만 anonymous (CORS)
        if (!videoUrl.startsWith("blob:")) {
        video.crossOrigin = "anonymous"
        }
        video.src = videoUrl
        video.muted = true
        video.playsInline = true
        video.className = "h-full w-full object-cover"
        // 모바일에서 더 나은 버퍼링을 위해 preload 설정
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                        (typeof window !== "undefined" && window.innerWidth <= 768)
        // 모바일: canplay만 기다림 (iOS는 canplaythrough가 재생 전에 안 뜨어서 끊김·타임아웃 원인)
        video.preload = "auto"
        // 클립이 장면 음성보다 짧으면 마지막 프레임에서 멈춰 보이지 않게 반복 (장면이 바뀌면 멈추고 다음 영상으로 넘어감)
        video.loop = true
        
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
                const sourceDuration = video.duration || durationPerVideo
                console.log(`[Shopping] 미리보기 영상 ${ordinal + 1} 로드 완료 (모바일), 장면: ${durationPerVideo.toFixed(2)}초, 원본: ${sourceDuration.toFixed(2)}초, readyState=${video.readyState}`)
                done()
              }
            } else {
              if (metadataLoaded && canPlay) {
            const sourceDuration = video.duration || durationPerVideo
            console.log(`[Shopping] 미리보기 영상 ${ordinal + 1} 로드 완료, 장면: ${durationPerVideo.toFixed(2)}초, 원본: ${sourceDuration.toFixed(2)}초`)
                done()
              }
            }
          }
          
          video.onloadedmetadata = () => {
            metadataLoaded = true
            console.log(`[Shopping] 미리보기 영상 ${ordinal + 1} 메타데이터 로드 완료`)
            checkReady()
          }
          
          video.oncanplay = () => {
            canPlay = true
            console.log(`[Shopping] 미리보기 영상 ${ordinal + 1} canplay 이벤트`)
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
            console.error(`[Shopping] 미리보기 영상 ${ordinal + 1} 로드 실패: code=${code}, message=${msg}`)
            fail(new Error(`영상 ${ordinal + 1} 로드 실패 (code: ${code}). 브라우저가 해당 형식을 지원하지 않거나 파일이 손상되었을 수 있습니다.`))
          }
          video.load()
          
          const timeout = isMobile ? 45000 : 10000
          setTimeout(() => {
            if (resolved) return
            if (metadataLoaded && canPlay) return
            if (isMobile) {
              console.warn(`미리보기 비디오 ${ordinal + 1} 로드 타임아웃 (모바일), 계속 진행 (readyState: ${video.readyState})`)
              if (video.readyState >= 2) {
                canPlay = true
                checkReady()
              } else {
                done()
              }
            } else {
              console.warn(`미리보기 비디오 ${ordinal + 1} 로드 타임아웃, 계속 진행`)
              if (video.readyState >= 1) {
                metadataLoaded = true
                canPlay = true
                checkReady()
              } else {
                done()
              }
            }
          }, timeout)
        })
        
        videoElements.push(video)
      }
      
      console.log(
        `[Shopping] 미리보기 ${videoElements.length}개 영상 로드 완료:`,
        videoDurations.map((d) => d.toFixed(2) + "초")
      )
      
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

      // 오디오를 마스터 클럭으로 사용해 영상 전환과 자막을 프레임 단위로 동기화한다.
      const syncPreviewToAudio = () => {
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
              // BGM만 정지하고 영상·자막 동기화는 계속 진행
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
                  // BGM만 정지하고 영상·자막 동기화는 계속 진행
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
        const THUMBNAIL_DURATION = 0
        const elapsedMs = elapsed * 1000
        
        // 각 영상의 시작 시간 계산
        const videoStartTimes: number[] = []
        let accumulatedVideoTime = THUMBNAIL_DURATION
        for (const videoDuration of videoDurations) {
          videoStartTimes.push(accumulatedVideoTime)
          accumulatedVideoTime += videoDuration
        }
        
        // 현재 시간에 맞는 영상 찾기 및 동기화
        let foundVideoIndex = -1
        let videoTime = 0
        
        if (elapsed >= THUMBNAIL_DURATION) {
          for (let i = 0; i < videoDurations.length; i++) {
            const startTime = videoStartTimes[i]
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
        if (foundVideoIndex >= 0) {
          const sceneStart = videoStartTimes[foundVideoIndex]
          const sceneEnd = sceneStart + videoDurations[foundVideoIndex]
          setVideoTransitionOpacity(
            getSceneBlinkOpacity(
              elapsed,
              sceneStart,
              sceneEnd,
              foundVideoIndex,
              videoDurations.length,
              transitionDuration
            )
          )
        } else {
          setVideoTransitionOpacity(1)
        }
        
        // 현재 영상 동기화
        if (foundVideoIndex >= 0 && videoElements[foundVideoIndex]) {
          const video = videoElements[foundVideoIndex]
          const syncedVideoTime = sceneClipTime(videoTime, video.duration)
          const holdingLastFrame =
            Number.isFinite(video.duration) && videoTime >= video.duration - 0.05
          
          // 이미 로드된 실제 video 엘리먼트를 교체해 장면 경계에서 지연 없이 전환한다.
          const switchedScene = previewVideoRef.current !== video
          if (switchedScene) {
            previewVideoRef.current?.pause()
            previewVideoHostRef.current?.replaceChildren(video)
            previewVideoRef.current = video
          }
          // 줌인 클립은 AI영상 단계의 <video> 재생과 같게 둔다.
          // 위에 CSS 줌을 한 번 더 얹거나 매 프레임 재생 위치를 덮어쓰면 디코더가 멈추고 줌이 끊긴다.
          if (useImageZoomInsteadOfAiVideo) {
            video.style.transform = ""
            video.style.willChange = "auto"
          } else {
            video.style.transformOrigin = "center center"
            video.style.willChange = "transform"
            video.style.transform = `scale(${scenePushInScale(videoTime / Math.max(0.001, videoDurations[foundVideoIndex]))})`
          }
          if (!Number.isNaN(video.duration) && video.duration > 0) {
            const drift = Math.abs(video.currentTime - syncedVideoTime)
            const seekLimit = useImageZoomInsteadOfAiVideo ? 0.8 : 0.35
            if (switchedScene || drift > seekLimit) {
              video.currentTime = syncedVideoTime
            }
            if (holdingLastFrame && !useImageZoomInsteadOfAiVideo) {
              if (!video.paused) video.pause()
            } else if (video.paused && !audio.paused) {
              void video.play().catch(() => undefined)
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
        if (previewScriptLines.length > 0 && (!previewThumbnailImage || elapsed >= THUMBNAIL_DURATION)) {
          const currentLine = previewScriptLines.find(
            line => elapsedMs >= line.startTime && elapsedMs < line.endTime
          )
          
          if (currentLine) {
            // 의미 단위로 나눠 한 줄씩 순서대로 (쉼표·마침표 기준)
            const phrases = getSubtitlePhrases(currentLine.text)
            const lineDuration = currentLine.endTime - currentLine.startTime
            const timeInLine = elapsedMs - currentLine.startTime
            const phraseIndex = getSubtitlePhraseIndex(phrases, timeInLine, lineDuration)
            setCurrentSubtitle(phrases[phraseIndex] ?? currentLine.text)
          } else {
            setCurrentSubtitle("")
          }
        } else {
          setCurrentSubtitle("")
        }
      }
      audio.addEventListener("timeupdate", syncPreviewToAudio)

      let previewSyncFrame = 0
      const runPreviewSyncLoop = () => {
        syncPreviewToAudio()
        if (!audio.paused && !audio.ended) {
          previewSyncFrame = requestAnimationFrame(runPreviewSyncLoop)
        }
      }
      audio.addEventListener("play", () => {
        cancelAnimationFrame(previewSyncFrame)
        previewSyncFrame = requestAnimationFrame(runPreviewSyncLoop)
      })
      audio.addEventListener("pause", () => cancelAnimationFrame(previewSyncFrame))
      audio.addEventListener("ended", () => cancelAnimationFrame(previewSyncFrame))

      // 미리보기용 오디오 및 비디오 설정 (3개 영상)
      setPreviewAudio(audio)
      setPreviewVideoElements(videoElements)
            
      setPreviewGenerated(true)
      setCurrentTime(0)
      setCurrentSubtitle("")
      requestAnimationFrame(() => {
        const firstVideo = videoElements[0]
        if (!firstVideo || !previewVideoHostRef.current) return
        firstVideo.currentTime = 0
        previewVideoHostRef.current.replaceChildren(firstVideo)
        previewVideoRef.current = firstVideo
      })
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
        // 루프를 켜면 장면 끝에서 줌이 1배로 되돌아갔다가 다시 점프한다.
        previewVideoRef.current.loop = false
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
    const pipelineSceneIndices = getPipelineSceneIndices()
    if (
      !previewGenerated ||
      !previewAudio ||
      pipelineSceneIndices.length === 0 ||
      !pipelineSceneIndices.every((index) => convertedVideoUrls.has(index)) ||
      !ttsAudioUrl
    ) {
      alert("미리보기를 먼저 생성하고, 선택한 장면 영상과 TTS를 모두 준비해주세요.")
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

      // 2) 선택된 장면 영상을 순서대로 업로드
      const videoUrls: string[] = []
      for (let ordinal = 0; ordinal < pipelineSceneIndices.length; ordinal++) {
        const sceneIndex = pipelineSceneIndices[ordinal]
        const url = convertedVideoUrls.get(sceneIndex)
        if (!url) throw new Error(`영상 ${sceneIndex + 1}이 없습니다.`)
        const blob = await getBlobFromUrl(url)
        const gcsUrl = await uploadBlobToGcsShopping(blob, `segment_${ordinal}`, blob.type || "video/webm")
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
        subtitles.push(...getSubtitlePhraseRanges(phrases, startSec, endSec))
      }

      const totalWeight = pipelineSceneIndices.reduce(
        (sum, index) =>
          sum + Math.max(1, storyboardScenes[index]?.narration.replace(/\s/g, "").length || 1),
        0
      )
      const requestedSegmentDurations = pipelineSceneIndices.map((sceneIndex) => {
        const timestampDuration = getSceneTtsDurationSeconds(
          scriptLines,
          storyboardScenes[sceneIndex]?.narration || "",
          sceneIndex
        )
        if (timestampDuration) return timestampDuration
        const weight = Math.max(
          1,
          storyboardScenes[sceneIndex]?.narration.replace(/\s/g, "").length || 1
        )
        return (durationSec * weight) / Math.max(1, totalWeight)
      })
      const requestedSegmentTotal = requestedSegmentDurations.reduce(
        (sum, duration) => sum + duration,
        0
      )
      let segmentStart = 0
      const videoSegments = pipelineSceneIndices.map((sceneIndex, ordinal) => {
        const segmentDuration =
          ordinal === pipelineSceneIndices.length - 1
            ? durationSec - segmentStart
            : (durationSec * requestedSegmentDurations[ordinal]) /
              Math.max(0.001, requestedSegmentTotal)
        const segment = {
          url: videoUrls[ordinal],
          startTime: segmentStart,
          endTime: segmentStart + segmentDuration,
          transition:
            ordinal > 0
              ? { type: "fade", duration: Math.min(transitionDuration, segmentDuration / 2) }
              : undefined,
        }
        segmentStart += segmentDuration
        return segment
      })

      const body: Record<string, unknown> = {
        type: "shopping",
        duration: durationSec,
        audioGcsUrl,
        subtitles,
        thumbnailImageUrl,
        videoSegments,
        transitionEffect: "fade",
        transitionDuration,
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

      // 사용자 기기로 영상 저장 (모바일/인앱: 공유·새 창·화면 링크, PC: 다운로드)
      const fileName = `${(factoryAutoRunItem?.productName || productName) || "shopping"}_server_${Date.now()}.mp4`
      const downloadUrl = URL.createObjectURL(blob)
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
      const inAppBrowser = /NAVER|Naver|KAKAOTALK|Daum|FBAN|FBAV/i.test(ua)
      const mobile = typeof navigator !== "undefined" && (inAppBrowser || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || (typeof window !== "undefined" && window.innerWidth <= 768))
      if (mobile) {
        // 모바일·인앱: 화면에 '영상 저장' 링크 항상 표시 (네이버 등 인앱에서는 자동 다운로드가 막힘)
        setServerDownloadLink({ url: downloadUrl, fileName })
        setTimeout(() => {
          setServerDownloadLink((prev) => {
            if (prev?.url === downloadUrl) URL.revokeObjectURL(downloadUrl)
            return null
          })
        }, 5 * 60 * 1000)
        const file = new File([blob], fileName, { type: "video/mp4" })
        const shared = typeof navigator !== "undefined" && typeof navigator.share === "function" && (navigator.canShare?.({ files: [file] }) ?? true)
        if (shared) {
          try {
            await navigator.share({ files: [file], title: fileName, text: "렌더링된 영상" })
            if (!factoryAutoRunItem) alert("공유 화면에서 '저장' 또는 '파일에 저장'을 선택하세요.")
          } catch (e) {
            if ((e as Error)?.name !== "AbortError") {
              window.open(downloadUrl, "_blank")
              if (!factoryAutoRunItem) alert("영상이 새 창에서 열렸을 수 있습니다.\n안 되면 아래 '영상 저장' 버튼을 눌러 주세요.")
            }
          }
        } else {
          window.open(downloadUrl, "_blank")
        }
        if (!factoryAutoRunItem) {
          if (inAppBrowser) {
            alert("서버 렌더링이 완료되었습니다.\n\n아래 '영상 저장' 버튼을 눌러 저장해 주세요. 저장이 안 되면 Chrome 또는 Safari에서 이 페이지를 열어 다시 시도해 주세요.")
          } else {
            alert("서버 렌더링이 완료되었습니다.\n아래 '영상 저장' 버튼을 눌러 주세요.")
          }
        }
      } else {
        const a = document.createElement("a")
        a.href = downloadUrl
        a.download = fileName
        a.click()
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000)
        if (!factoryAutoRunItem) alert("서버 렌더링이 완료되었습니다. 다운로드가 시작됩니다.")
      }

      // 자동화 모드 모드: 서버에서 받은 영상으로 저장 후 유튜브 자동 업로드
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
          const clientId = typeof window !== "undefined" ? localStorage.getItem("shopping_v2_factory_youtube_client_id") : null
          const clientSecret = typeof window !== "undefined" ? localStorage.getItem("shopping_v2_factory_youtube_client_secret") : null
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
          alert("공장 예약 완료. 자동화 모드 목록에서 다운로드할 수 있습니다.")
        }
      }

      // 자동화 모드 제거됨 — 완료 후 프로젝트 목록으로
      if (factoryAutoRunItem) {
        setFactoryAutoRunItem(null)
        setShowProjectList(true)
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

  // 고품질 렌더링: 리믹스 쇼핑숏폼 v2 마감(모션·강조 자막·효과음·BGM 덕킹·광고 표기)을 쓰는 서버 엔진
  const handleProRender = async () => {
    const videoMap = collectExistingSceneVideos()
    const sceneIndices =
      sceneTtsTracks.length > 0
        ? sceneTtsTracks.map((track) => track.sceneIndex)
        : getPipelineSceneIndices()
    if (sceneIndices.length === 0 || !sceneIndices.every((i) => videoMap.has(i) || imageUrls[i])) {
      alert("모든 장면에 영상 또는 이미지가 있어야 합니다.")
      return
    }
    // 장면별 음성이 서버에 저장된 주소면 그대로 넘긴다 (합친 음성의 blob: 주소는 새로고침하면 사라져 못 읽음)
    const sceneTtsUrls = sceneIndices.map((i) => sceneTtsTracks.find((t) => t.sceneIndex === i)?.audioUrl?.trim() || "")
    const perSceneNarration = sceneTtsUrls.length > 0 && sceneTtsUrls.every((u) => /^https?:\/\//.test(u)) ? sceneTtsUrls : null
    let narrationUrl = (ttsAudioUrl || "").trim()
    if (narrationUrl.startsWith("blob:")) {
      const alive = await fetch(narrationUrl).then((r) => r.ok, () => false)
      if (!alive) narrationUrl = ""
    }
    if (!narrationUrl && !perSceneNarration && sceneTtsUrls.every(Boolean)) {
      narrationUrl = await mergeSceneTtsAudioUrls(sceneTtsUrls).catch(() => "")
      if (narrationUrl) setTtsAudioUrl(narrationUrl)
    }
    if ((!narrationUrl && !perSceneNarration) || scriptLines.length === 0) {
      alert("TTS와 자막이 준비되어야 합니다. 미리보기를 먼저 생성해주세요.")
      return
    }

    setProRenderStatus("uploading")
    setError("")
    try {
      // blob: 주소는 서버가 못 읽으므로 GCS에 올린다 (http·data·/경로는 그대로)
      const toServerUrl = async (url: string, name: string) => {
        if (!url.startsWith("blob:")) return url
        const res = await fetch(url).catch(() => null)
        if (!res?.ok) throw new Error(`${name} 파일이 브라우저에서 사라졌어요. 해당 단계에서 다시 만들어 주세요.`)
        const blob = await res.blob()
        // 숏폼 GCS 버킷이 막히면(결제 계정 문제 등) Supabase 저장소로 대신 올린다
        return uploadBlobToGcsShopping(blob, name, blob.type || "application/octet-stream").catch((gcsErr) => {
          console.warn("[render-pro] GCS 업로드 실패, Supabase로 재시도:", gcsErr)
          // 서버가 서명한 업로드 주소로 올린다 (TTS 저장과 같은 방식 — 브라우저 직접 업로드는 저장소 권한에 막힘)
          const t = blob.type || ""
          const kind = t.startsWith("image/") ? "image" : t.startsWith("video/") ? "clip" : "tts"
          if (!userId || !currentProject?.id) throw new Error("로그인 후 프로젝트를 저장한 뒤 다시 시도해 주세요.")
          return uploadMediaBlobToStorage(blob, userId, currentProject.id, kind)
        })
      }
      const totalWeight = sceneIndices.reduce((s, i) => s + Math.max(1, storyboardScenes[i]?.narration.replace(/\s/g, "").length || 1), 0)
      const scenes = []
      for (const [ordinal, i] of sceneIndices.entries()) {
        const track = sceneTtsTracks.find((t) => t.sceneIndex === i)
        const duration =
          (track?.durationMs ? track.durationMs / 1000 : null) ??
          getSceneTtsDurationSeconds(scriptLines, storyboardScenes[i]?.narration || "", i) ??
          Math.max(1, storyboardScenes[i]?.narration.replace(/\s/g, "").length || 1) / totalWeight * 30 // 서버가 나레이션 길이에 맞춰 비율 보정
        // 영상 후보: 변환 영상 → 스토리보드 영상. 새로고침으로 사라진 blob: 주소면 다음 후보, 다 없으면 장면 이미지(천천히 움직임)
        const live = async (u?: string) => {
          const t = (u || "").trim()
          if (!t) return ""
          if (!t.startsWith("blob:")) return t
          return (await fetch(t).then((r) => r.ok, () => false)) ? t : ""
        }
        const video = (await live(convertedVideoUrls.get(i))) || (await live(storyboardScenes[i]?.videoUrl)) || ""
        const image = video ? "" : await live(imageUrls[i])
        if (!video && !image) throw new Error(`${ordinal + 1}번 장면의 영상·이미지가 없어요. AI 영상 단계에서 다시 만들어 주세요.`)
        scenes.push({
          url: await toServerUrl(video || image, `pro_scene_${ordinal}`),
          duration,
          kind: video ? ("video" as const) : ("image" as const),
        })
      }
      const cues: { start: number; end: number; text: string }[] = []
      for (const line of scriptLines) {
        const phrases = getSubtitlePhrases(line.text)
        if (phrases.length > 0) cues.push(...getSubtitlePhraseRanges(phrases, line.startTime / 1000, line.endTime / 1000))
      }
      const thumb = selectedThumbnailIndex >= 0 ? thumbnailImages[selectedThumbnailIndex] : undefined
      const thumbSrc = thumb?.url || thumbnailUrl || ""
      const body = {
        scenes,
        narration: perSceneNarration ? { perScene: perSceneNarration } : { url: await toServerUrl(narrationUrl, "pro_tts") },
        cues,
        headcopy: thumb ? [thumb.text.line1 || "", thumb.text.line2 || ""] : [productName || "", ""],
        bgm: bgmUrl ? { url: await toServerUrl(bgmUrl, "pro_bgm").catch(() => ""), volume: Math.min(0.5, bgmVolume) } : undefined,
        sfx: { enabled: true, preset: "viral" },
        motion: { enabled: true, preset: "full" },
        seed: Math.floor(Math.random() * 1000),
        affiliate: "coupang",
        aiUsed: true,
        thumbnailUrl: thumbSrc ? await toServerUrl(thumbSrc, "pro_thumb").catch(() => undefined) : undefined,
      }
      setProRenderStatus("rendering")
      const res = await fetch("/api/ai-shopping/render-pro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) throw new Error(data.error || `렌더 요청 실패: ${res.status}`)
      // 렌더는 서버 뒤에서 돈다 → 끝날 때까지 상태를 확인 (최대 20분)
      for (let i = 0; ; i++) {
        if (i > 400) throw new Error("렌더링이 너무 오래 걸려요. 잠시 뒤 다시 시도해 주세요.")
        await new Promise((r) => setTimeout(r, 3000))
        const st = await fetch(`${data.url}?status`, { cache: "no-store" }).then((r) => r.json()).catch(() => null)
        if (st?.state === "done") break
        if (st?.state === "error") throw new Error(st.error || "렌더링 실패")
      }
      setVideoUrl(data.url)
      const a = document.createElement("a")
      a.href = `${data.url}?download`
      a.download = `${productName || "shopping"}_pro_${Date.now()}.mp4`
      a.click()
      alert("고품질 렌더링이 완료되었습니다. 다운로드가 시작됩니다.")
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`고품질 렌더링 실패: ${msg}`)
      alert(`고품질 렌더링에 실패했습니다.\n\n${msg}`)
    } finally {
      setProRenderStatus("idle")
    }
  }

  // 최종 영상 렌더링 (미리보기와 동일). 필요하면 onComplete로 blob을 전달합니다.
  const handleRenderVideo = async (options?: { onComplete?: (blob: Blob) => void }) => {
    const videoMap = collectExistingSceneVideos()
    const pipelineSceneIndices =
      sceneTtsTracks.length > 0
        ? sceneTtsTracks.map((track) => track.sceneIndex)
        : videoMap.size > 0
          ? Array.from(videoMap.keys()).sort((a, b) => a - b)
          : getPipelineSceneIndices()

    let effectiveTtsUrl = (ttsAudioUrl || "").trim()
    if (!effectiveTtsUrl && sceneTtsTracks.length > 0) {
      const orderedTrackUrls = pipelineSceneIndices
        .map(
          (sceneIndex) =>
            sceneTtsTracks.find((track) => track.sceneIndex === sceneIndex)?.audioUrl?.trim() || ""
        )
        .filter(Boolean)
      if (orderedTrackUrls.length === pipelineSceneIndices.length && orderedTrackUrls.length > 0) {
        try {
          effectiveTtsUrl = await mergeSceneTtsAudioUrls(orderedTrackUrls)
          setTtsAudioUrl(effectiveTtsUrl)
        } catch (mergeError) {
          console.warn("[Shopping] 렌더용 장면 TTS 병합 실패:", mergeError)
        }
      }
    }

    if (
      pipelineSceneIndices.length === 0 ||
      !pipelineSceneIndices.every((index) => videoMap.has(index)) ||
      !effectiveTtsUrl ||
      !canvasRef.current
    ) {
      alert("선택한 장면 영상과 TTS가 모두 준비되어야 합니다.")
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

      // 미리보기 Audio에 createMediaElementSource를 걸면 브라우저가 그 엘리먼트의
      // 기본 스피커 출력을 영구적으로 끊는다 → 녹화 중·녹화 후 미리보기가 무음이 됨.
      // 다운로드 녹화는 반드시 별도 Audio 인스턴스를 쓴다.
      previewAudio.pause()
      const renderSrc = (
        previewAudio.currentSrc ||
        previewAudio.src ||
        effectiveTtsUrl ||
        ""
      ).trim()
      if (!renderSrc) throw new Error("TTS 오디오 URL이 없습니다.")
      const audio = new Audio(renderSrc)
      audio.crossOrigin = "anonymous"
      audio.preload = "auto"
      await new Promise<void>((resolve, reject) => {
        const done = () => resolve()
        audio.onloadedmetadata = done
        audio.oncanplaythrough = done
        audio.onerror = () => reject(new Error("렌더용 TTS 로드 실패"))
        audio.load()
      })
      audio.currentTime = 0
      const actualAudioDuration =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : previewAudio.duration
      console.log("[Shopping] 실제 오디오 길이:", actualAudioDuration.toFixed(3), "초")

      // 선택 장면 영상 엘리먼트 생성 및 로드
      const videoElements: HTMLVideoElement[] = []
      const videoDurations: number[] = []

      for (let ordinal = 0; ordinal < pipelineSceneIndices.length; ordinal++) {
        const sceneIndex = pipelineSceneIndices[ordinal]
        const videoUrl = videoMap.get(sceneIndex) || convertedVideoUrls.get(sceneIndex)
        if (!videoUrl) {
          throw new Error(`영상 ${sceneIndex + 1}이 준비되지 않았습니다.`)
        }
        const durationPerVideo =
          (sceneTtsTracks.find((track) => track.sceneIndex === sceneIndex)?.durationMs || 0) /
            1000 ||
          actualAudioDuration / Math.max(1, pipelineSceneIndices.length)
        
        const video = document.createElement("video")
        video.src = videoUrl
        video.crossOrigin = "anonymous"
        // 모바일에서 더 나은 버퍼링을 위해 preload 설정
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                        (typeof window !== "undefined" && window.innerWidth <= 768)
        video.preload = isMobile ? "metadata" : "auto"
        video.muted = true
        video.playsInline = true
        // 클립이 장면 음성보다 짧아도 멈춰 보이지 않게 반복
        video.loop = true
        
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => {
            videoDurations.push(durationPerVideo)
            console.log(`[Shopping] 영상 ${ordinal + 1} 로드 완료, 장면 TTS 길이: ${durationPerVideo.toFixed(2)}초`)
            resolve()
          }
          // 모바일에서 버퍼링 개선
          if (isMobile) {
            video.oncanplaythrough = () => {
              if (!videoDurations.includes(durationPerVideo)) {
                videoDurations.push(durationPerVideo)
              }
            }
          }
          video.onerror = reject
          video.load()
          
          // 모바일에서는 타임아웃을 더 길게
          if (isMobile) {
            setTimeout(() => {
              if (video.readyState >= 1) {
                if (!videoDurations.includes(durationPerVideo)) {
                  videoDurations.push(durationPerVideo)
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
      // MediaRecorder용 + 스피커 모니터링(녹화 중에도 들리게)
      ttsGainNode.connect(destination)
      ttsGainNode.connect(audioContext.destination)
      if (bgmGainNode) {
        bgmGainNode.connect(destination)
        bgmGainNode.connect(audioContext.destination)
      }
      if (sfxGainNode) {
        sfxGainNode.connect(destination)
        sfxGainNode.connect(audioContext.destination)
      }

      const videoTrack = stream.getVideoTracks()[0]
      const audioTrack = destination.stream.getAudioTracks()[0]
      const combinedStream = new MediaStream([videoTrack, audioTrack])

      // 부드러운 렌더링을 위한 MediaRecorder 설정 (Safari/iOS는 vp9 미지원 → 폴백으로 끊김 방지)
      // 쇼츠·릴스 업로드 호환을 위해 MP4(H.264)를 우선, 미지원 브라우저는 WebM
      const recOptions: { mimeType?: string; videoBitsPerSecond?: number } = { videoBitsPerSecond: 12_000_000 }
      if (typeof MediaRecorder !== "undefined") {
        recOptions.mimeType = [
          "video/mp4;codecs=avc1.640028,mp4a.40.2",
          "video/mp4;codecs=avc1,mp4a.40.2",
          "video/mp4",
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
        ].find((type) => MediaRecorder.isTypeSupported(type))
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
          console.log("[Shopping] 영상 렌더링 완료 (외부 저장 콜백)")
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
        a.download = `${productName || "shopping"}_video_${Date.now()}.${recordedMimeType.startsWith("video/mp4") ? "mp4" : "webm"}`
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
      if (bgmGainNode) {
        // 마지막 1.5초 BGM 페이드아웃 — 뚝 끊기지 않게
        const startAt = audioContext.currentTime
        const fadeStart = Math.max(0, actualAudioDuration - 1.5)
        bgmGainNode.gain.setValueAtTime(bgmVolume, startAt + fadeStart)
        bgmGainNode.gain.linearRampToValueAtTime(0, startAt + actualAudioDuration)
      }
      
      // BGM과 효과음이 AudioContext를 통해 재생되도록 확인
      console.log("[Shopping] 렌더링 시작 - BGM:", bgmUrl ? "있음" : "없음", "효과음:", sfxUrl ? "있음" : "없음")

      // 롱폼 쇼츠 생성기 방식으로 렌더링 (썸네일 + 3개 영상 순차 재생)
      // 미리보기와 완전히 동일한 로직 사용
      const THUMBNAIL_DURATION = 0
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
        if (renderFinished) return
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
                video.currentTime = sceneClipTime(videoElapsed, video.duration)
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
            
            // 재생이 눈에 띄게 어긋났을 때만 맞춘다. 매 프레임 되감으면 줌이 끊긴다.
            if (currentVideo && !isNaN(currentVideo.duration) && currentVideo.duration > 0) {
              const targetTime = sceneClipTime(videoElapsed, currentVideo.duration)
              const holdingLastFrame = videoElapsed >= currentVideo.duration - 0.05
              const drift = Math.abs(currentVideo.currentTime - targetTime)
              if (useImageZoomInsteadOfAiVideo) {
                // AI영상 미리보기와 같이 클립을 그대로 재생한다. 자주 되감으면 줌이 끊긴다.
                if (drift > 0.8) currentVideo.currentTime = targetTime
                if (currentVideo.paused) currentVideo.play().catch(() => {})
              } else if (holdingLastFrame) {
                if (!currentVideo.paused) currentVideo.pause()
                if (drift > 0.1) currentVideo.currentTime = targetTime
              } else {
                if (drift > 0.35) currentVideo.currentTime = targetTime
                if (currentVideo.paused) currentVideo.play().catch(() => {})
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
                
                const sceneStart = videoStartTimes[currentVideoIndex]
                const sceneEnd =
                  currentVideoIndex < videoStartTimes.length - 1
                    ? videoStartTimes[currentVideoIndex + 1]
                    : sceneStart + videoDurations[currentVideoIndex]
                const pushIn = useImageZoomInsteadOfAiVideo
                  ? 1
                  : scenePushInScale(
                      (adjustedElapsed - sceneStart) / Math.max(0.001, sceneEnd - sceneStart)
                    )
                ctx.globalAlpha = getSceneBlinkOpacity(
                  adjustedElapsed,
                  sceneStart,
                  sceneEnd,
                  currentVideoIndex,
                  videoDurations.length,
                  transitionDuration
                )
                ctx.drawImage(
                  currentVideo,
                  0,
                  0,
                  videoWidth,
                  videoHeight,
                  drawX - (drawWidth * (pushIn - 1)) / 2,
                  drawY - (drawHeight * (pushIn - 1)) / 2,
                  drawWidth * pushIn,
                  drawHeight * pushIn
                )
                ctx.globalAlpha = 1
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
            const phraseIndex = getSubtitlePhraseIndex(phrases, timeInLine, lineDuration)
            const textToShow = phrases[phraseIndex] || currentLine.text
            // 편집 미리보기(최대 너비 280px)와 같은 좌표·크기 공식을 사용한다.
            const previewStageWidth = 280
            const scaleFactor = canvas.width / previewStageWidth
            const horizontalPercent = subtitleStyle.horizontalPercent ?? 50
            const verticalPercent =
              subtitleStyle.verticalPercent ??
              (subtitleStyle.position === "top"
                ? 15
                : subtitleStyle.position === "center"
                  ? 50
                  : SHOPPING_SUBTITLE_BOTTOM_PERCENT)
            const subtitleX = canvas.width * (horizontalPercent / 100)
            const subtitleY = canvas.height * (verticalPercent / 100)
            const previewFontSize = Math.max(
              12,
              Math.min(
                subtitleStyle.fontSize * 0.45,
                220 / Math.max(1, textToShow.replace(/\s/g, "").length)
              )
            )
            let fontSize = previewFontSize * scaleFactor
            ctx.font = `${subtitleStyle.fontWeight} ${fontSize}px '${subtitleStyle.fontFamily}', sans-serif`
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            
            // 텍스트 크기 측정 (배경 그리기용)
            let textMetrics = ctx.measureText(textToShow)
            const maxSubtitleWidth = canvas.width * 0.88
            if (textMetrics.width > maxSubtitleWidth) {
              fontSize *= maxSubtitleWidth / textMetrics.width
              ctx.font = `${subtitleStyle.fontWeight} ${fontSize}px '${subtitleStyle.fontFamily}', sans-serif`
              textMetrics = ctx.measureText(textToShow)
            }
            const textWidth = textMetrics.width
            const textHeight = fontSize
            const padding = fontSize * 0.2 // 패딩 계산
            
            // 배경 그리기 (backgroundColor가 투명도가 있으면)
            if (subtitleStyle.backgroundColor && subtitleStyle.backgroundColor !== "transparent") {
              const bgColor = subtitleStyle.backgroundColor
              ctx.fillStyle = bgColor
              
              const bgX = subtitleX - textWidth / 2 - padding
              const bgY = subtitleY - textHeight / 2 - padding
              const bgWidth = textWidth + padding * 2
              const bgHeight = textHeight + padding * 2
              
              // 둥근 모서리 배경 (간단한 사각형으로 대체)
              ctx.fillRect(bgX, bgY, bgWidth, bgHeight)
            }
            
            // 미리보기와 같은 그림자 색상·거리·각도를 적용한다.
            if (subtitleStyle.shadowEnabled !== false && subtitleStyle.textShadow) {
              const shadowDistance = (subtitleStyle.shadowDistance ?? 3) * scaleFactor
              const shadowAngle = ((subtitleStyle.shadowAngle ?? -46) * Math.PI) / 180
              ctx.shadowColor = subtitleStyle.shadowColor || "#000000"
              ctx.shadowBlur = 4 * scaleFactor
              ctx.shadowOffsetX = Math.cos(shadowAngle) * shadowDistance
              ctx.shadowOffsetY = Math.sin(shadowAngle) * shadowDistance
            } else {
              ctx.shadowColor = "transparent"
              ctx.shadowBlur = 0
              ctx.shadowOffsetX = 0
              ctx.shadowOffsetY = 0
            }
            
            if (subtitleStyle.outlineEnabled !== false && (subtitleStyle.outlineWidth ?? 4) > 0) {
              ctx.strokeStyle = subtitleStyle.outlineColor || "#000000"
              ctx.lineWidth = (subtitleStyle.outlineWidth ?? 4) * 0.35 * scaleFactor
              ctx.lineJoin = "round"
              ctx.miterLimit = 2
              ctx.strokeText(textToShow, subtitleX, subtitleY)
            }
            ctx.fillStyle = subtitleStyle.color
            ctx.fillText(textToShow, subtitleX, subtitleY)
            ctx.shadowColor = "transparent"
            ctx.shadowBlur = 0
            ctx.shadowOffsetX = 0
            ctx.shadowOffsetY = 0
          }
        }

        if (audio.paused || elapsed >= actualAudioDuration) finishRender()
      }

      let renderFinished = false
      let stopTicker = () => {}
      const finishRender = () => {
        if (renderFinished) return
        renderFinished = true
        stopTicker()
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
        void audioContext.close().catch(() => undefined)
        // 미리보기 재생 위치만 처음으로 (엘리먼트는 건드리지 않음)
        try {
          previewAudio.currentTime = 0
        } catch {
          /* ignore */
        }
      }

      audio.addEventListener("ended", finishRender, { once: true })
      renderFrame()
      if (!renderFinished) stopTicker = startRenderTicker(renderFrame)
    } catch (error) {
      console.error("영상 렌더링 실패:", error)
      setError(`영상 렌더링에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
      setIsRendering(false)
    }
  }

  /** AI이미지 → 줌인 클립으로 장면 영상 준비 (Seedance 없이). 성공 시 true */
  const handlePrepareImageZoomClips = async (opts?: {
    silent?: boolean
  }): Promise<boolean> => {
    const sceneIndices = storyboardScenes
      .map((_, index) => index)
      .filter((index) => Boolean(imageUrls[index]?.trim()))
    if (sceneIndices.length === 0) {
      alert("AI이미지 단계에서 장면 이미지를 먼저 만들어 주세요.")
      return false
    }

    setUseImageZoomInsteadOfAiVideo(true)
    setImageZoomClipsPrepared(false)
    setIsPreparingImageZoomClips(true)
    setError("")
    setIsConvertingToVideo((prev) => {
      const next = new Map(prev)
      sceneIndices.forEach((i) => next.set(i, true))
      return next
    })

    try {
      const totalNarrationWeight = sceneIndices.reduce(
        (sum, index) =>
          sum + Math.max(1, storyboardScenes[index]?.narration.replace(/\s/g, "").length || 1),
        0
      )
      let totalTtsSec = 12
      if (sceneTtsTracks.length > 0) {
        totalTtsSec = Math.max(
          1,
          sceneTtsTracks.reduce((sum, track) => sum + track.durationMs, 0) / 1000
        )
      } else if (ttsAudioUrl) {
        try {
          const audio = new Audio(ttsAudioUrl)
          await new Promise<void>((resolve, reject) => {
            audio.onloadedmetadata = () => resolve()
            audio.onerror = () => reject(new Error("TTS 길이 확인 실패"))
            audio.load()
          })
          if (isFinite(audio.duration) && audio.duration > 0) totalTtsSec = audio.duration
        } catch {
          /* keep default */
        }
      }

      // 이전 blob URL 정리 (메모리 누수 방지)
      convertedVideoUrls.forEach((url) => {
        if (typeof url === "string" && url.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(url)
          } catch {
            /* ignore */
          }
        }
      })

      const nextMap = new Map<number, string>()
      for (const index of sceneIndices) {
        const imageUrl = imageUrls[index]
        if (!imageUrl) continue

        const track = sceneTtsTracks.find((item) => item.sceneIndex === index)
        const weight = Math.max(
          1,
          storyboardScenes[index]?.narration.replace(/\s/g, "").length || 1
        )
        const durationSec = Math.max(
          1.5,
          Math.min(
            12,
            track?.durationMs
              ? track.durationMs / 1000
              : (totalTtsSec * weight) / Math.max(1, totalNarrationWeight)
          )
        )

        console.log(
          `[Shopping] 이미지 줌인 클립 생성 M${index + 1} (${durationSec.toFixed(2)}초)`
        )
        const objectUrl = await renderImageZoomClipObjectUrl({
          imageUrl,
          durationSec,
          maxScale: 1.14,
        })
        nextMap.set(index, objectUrl)
        setConvertedVideoUrls(new Map(nextMap))
        setSceneVideoAt(index, objectUrl)
        setSelectedVideoSlots((prev) => {
          const next = new Set(prev)
          next.add(index)
          return next
        })
        setIsConvertingToVideo((prev) => {
          const next = new Map(prev)
          next.set(index, false)
          return next
        })
      }

      if (nextMap.size === 0) {
        throw new Error("생성할 줌인 클립이 없습니다.")
      }

      setConvertedVideoUrls(new Map(nextMap))
      setImageZoomClipsPrepared(true)
      if (!opts?.silent) {
        alert(
          `이미지 줌인 클립 ${nextMap.size}개를 준비했습니다. Seedance 없이 미리보기·다운로드할 수 있습니다.`
        )
      }
      return true
    } catch (error) {
      console.error("[Shopping] 이미지 줌인 클립 실패:", error)
      setImageZoomClipsPrepared(false)
      setError(
        error instanceof Error
          ? error.message
          : "이미지 줌인 클립 생성에 실패했습니다."
      )
      alert(
        error instanceof Error
          ? error.message
          : "이미지 줌인 클립 생성에 실패했습니다."
      )
      return false
    } finally {
      setIsPreparingImageZoomClips(false)
      setIsConvertingToVideo(new Map())
    }
  }

  /** convertedVideoUrls + storyboard.videoUrl 을 합쳐 "이미 있는 영상" 판정 */
  const collectExistingSceneVideos = (opts?: { ignoreStoryboard?: boolean }) => {
    const map = new Map<number, string>()
    convertedVideoUrls.forEach((url, index) => {
      const trimmed = typeof url === "string" ? url.trim() : ""
      if (trimmed) map.set(index, trimmed)
    })
    if (!opts?.ignoreStoryboard) {
      storyboardScenes.forEach((scene, index) => {
        if (map.has(index)) return
        const trimmed = typeof scene.videoUrl === "string" ? scene.videoUrl.trim() : ""
        if (trimmed) map.set(index, trimmed)
      })
    }
    return map
  }

  // 대본 장면에서 선택한 이미지를 같은 순서의 영상으로 변환
  const handleConvertAllImagesToVideos = async (options?: { onlyMissing?: boolean; forceAll?: boolean }) => {
    const onlyMissing = options?.onlyMissing !== false
    const forceAll = options?.forceAll === true

    // forceAll이면 기존 영상 초기화 후 전체 재생성
    if (forceAll) {
      setConvertedVideoUrls(new Map())
      setVideoPrompts(new Map())
      setStoryboardScenes((prev) => prev.map((scene) => ({ ...scene, videoUrl: undefined })))
    }

    const effectiveSceneIndices = storyboardScenes
      .map((_, index) => index)
      .filter((index) => Boolean(imageUrls[index]))
    // 미생성만: Map에 없어도 storyboard에 videoUrl이 있으면 건너뜀
    const existingVideos = forceAll ? new Map<number, string>() : collectExistingSceneVideos()
    // 스토리보드에만 있던 URL을 Map에도 동기화해 UI/저장이 어긋나지 않게 함
    if (!forceAll) {
      let needsSync = existingVideos.size !== convertedVideoUrls.size
      if (!needsSync) {
        existingVideos.forEach((url, index) => {
          if (convertedVideoUrls.get(index) !== url) needsSync = true
        })
      }
      if (needsSync) setConvertedVideoUrls(new Map(existingVideos))
    }
    const slotsToGenerate = effectiveSceneIndices.filter((i) => {
      if (onlyMissing && existingVideos.has(i)) return false
      return !!imageUrls[i]
    })

    if (slotsToGenerate.length === 0) {
      if (effectiveSceneIndices.length > 0 && effectiveSceneIndices.every((i) => existingVideos.has(i))) {
        alert("모든 장면 영상이 이미 있습니다. 개별 재생성 또는 전체 재생성을 사용해주세요.")
      } else {
        alert("생성할 장면 이미지가 없습니다. AI이미지 단계에서 이미지를 준비해주세요.")
      }
      return
    }

    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined

    if (!replicateApiKey) {
      alert("Replicate API 키가 필요합니다. 메인 화면의 설정(톱니바퀴 아이콘)에서 API 키를 입력해주세요.")
      return
    }

    // 즉시 로딩 상태 표시 (생성 대상만)
    setIsGeneratingVideoPrompts((prev) => {
      const newMap = new Map(prev)
      slotsToGenerate.forEach((i) => newMap.set(i, true))
      return newMap
    })
    setIsConvertingToVideo((prev) => {
      const newMap = new Map(prev)
      slotsToGenerate.forEach((i) => newMap.set(i, true))
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
      
      const totalNarrationWeight = effectiveSceneIndices.reduce(
        (sum, index) => sum + Math.max(1, storyboardScenes[index]?.narration.replace(/\s/g, "").length || 1),
        0
      )
      const durationByScene = new Map(
        effectiveSceneIndices.map((index) => {
          const weight = Math.max(
            1,
            storyboardScenes[index]?.narration.replace(/\s/g, "").length || 1
          )
          // 실제 장면 음성 길이(쉼·앞뒤 여백 포함)를 먼저 쓴다. 자막 구간만 더하면 짧게 잡혀 영상이 중간에 멈춘다
          const trackMs = sceneTtsTracks.find((t) => t.sceneIndex === index)?.durationMs
          const timestampDuration =
            (trackMs ? trackMs / 1000 : undefined) ??
            getSceneTtsDurationSeconds(scriptLines, storyboardScenes[index]?.narration || "", index)
          const calculatedDuration =
            timestampDuration ??
            Math.max(1, Math.round((totalTtsDuration * weight) / totalNarrationWeight))
          return [
            index,
            voiceLedTargetSeconds(
              calculatedDuration,
              SHOPPING_VIDEO_MODEL_META[videoGenerationModel].maxDuration
            ),
          ]
        })
      )
      console.log(
        `[Shopping] ${effectiveSceneIndices.length}개 장면 영상 변환 시작 (TTS ${totalTtsDuration}초, 대사 글자 수 비례)`
      )
      
      const videoResults: Array<{ index: number; videoUrl: string; duration: number; sceneType: string }> = []
      const newVideoMap = new Map<number, string>(existingVideos)
      const sceneName = (index: number) =>
        storyboardScenes[index]?.title || `장면 ${index + 1}`
      
      // 1단계: 생성 대상 장면 프롬프트 생성 (OpenAI)
      console.log(
        `[Shopping] 📝 1단계: 영상 프롬프트 생성 시작 (대상 ${slotsToGenerate.length}개, ${SHOPPING_VIDEO_MODEL_META[videoGenerationModel].label})`
      )
      const videoPromptsMap = new Map<number, string>()

      for (const i of effectiveSceneIndices) {
        if (existingVideos.has(i) && videoPrompts.has(i) && !slotsToGenerate.includes(i)) {
          videoPromptsMap.set(i, videoPrompts.get(i)!)
        }
      }
      
      for (const i of slotsToGenerate) {
        setIsGeneratingVideoPrompts((prev) => {
          const newMap = new Map(prev)
          newMap.set(i, true)
          return newMap
        })
        
        try {
          console.log(`[Shopping] 🤖 ${sceneName(i)} 프롬프트 생성 중...`)
          // 편집해 둔 프롬프트가 있으면 재사용
          const existingPrompt = videoPrompts.get(i)?.trim()
          const videoPrompt =
            existingPrompt ||
            storyboardScenes[i]?.motionPrompt?.trim() ||
            (await generateVideoPromptFromScript(
              storyboardScenes[i]?.narration || imagePrompts[i]?.scriptText || "",
              productName,
              durationByScene.get(i) || 1,
              productDescription
            ))
          
          videoPromptsMap.set(i, videoPrompt)
          setVideoPrompts((prev) => {
            const newMap = new Map(prev)
            newMap.set(i, videoPrompt)
            return newMap
          })
        } catch (error) {
          console.error(`[Shopping] ❌ ${sceneName(i)} 프롬프트 생성 실패:`, error)
          setError(`${sceneName(i)} 프롬프트 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
          throw error
        } finally {
          setIsGeneratingVideoPrompts((prev) => {
            const newMap = new Map(prev)
            newMap.set(i, false)
            return newMap
          })
        }
      }
      
      // 2단계: 사용자가 선택한 Replicate 모델로 영상 생성
      console.log(
        `[Shopping] 🎬 2단계: ${SHOPPING_VIDEO_MODEL_META[videoGenerationModel].label} 영상 생성 시작`
      )
      
      for (const i of slotsToGenerate) {
        const imageUrl = imageUrls[i]
        const videoPrompt = videoPromptsMap.get(i)
        
        if (!imageUrl || !videoPrompt) {
          throw new Error(`${sceneName(i)} 이미지/프롬프트가 없습니다.`)
        }
        
        setIsConvertingToVideo((prev) => {
          const newMap = new Map(prev)
          newMap.set(i, true)
          return newMap
        })
        
        try {
          const sceneDuration = durationByScene.get(i) || 1
          const videoUrl =
            i === 0
              ? await renderProductPhotoMaster(imageUrl, sceneDuration, "right").catch(async (stillError) => {
                  console.warn("[Shopping] 원본 제품 마스터 실패, AI 영상으로 대체:", stillError)
                  return generateVideoWithSeedance(
                    imageUrl,
                    videoPrompt,
                    sceneDuration,
                    replicateApiKey,
                    videoGenerationModel
                  )
                })
              : await generateVideoWithSeedance(
                  imageUrl,
                  videoPrompt,
                  sceneDuration,
                  replicateApiKey,
                  videoGenerationModel
                )
          
          console.log(`[Shopping] ✅ ${sceneName(i)} 생성 완료:`, videoUrl)
          newVideoMap.set(i, videoUrl)
          setConvertedVideoUrls(new Map(newVideoMap))
          setSceneVideoAt(i, videoUrl)
          setSelectedVideoSlots((prev) => {
            const next = new Set(prev)
            next.add(i)
            return next
          })
          
          videoResults.push({
            index: i,
            videoUrl,
            duration: durationByScene.get(i) || 1,
            sceneType: sceneName(i)
          })
        } catch (error) {
          console.error(`[Shopping] ❌ ${sceneName(i)} 생성 실패:`, error)
          throw error
        } finally {
          setIsConvertingToVideo((prev) => {
            const newMap = new Map(prev)
            newMap.set(i, false)
            return newMap
          })
        }
      }
      
      const totalVideoDuration = videoResults.reduce((sum, result) => sum + result.duration, 0)
      console.log(`[Shopping] 영상 변환 완료 (${videoResults.length}개, 합계 ${totalVideoDuration}초, TTS ${totalTtsDuration}초)`)
      setConvertedVideoUrls(new Map(newVideoMap))
      
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
  const handleRegenerateSingleVideo = async (index: number) => {
    if (imageUrls.length <= index) {
      alert("해당 이미지가 없습니다.")
      return
    }

    const replicateApiKey = typeof window !== "undefined" ? localStorage.getItem("shotform_replicate_api_key") || undefined : undefined
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
    
    const sceneName = storyboardScenes[index]?.title || `장면 ${index + 1}`
    
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
      
      const effectiveIndices = storyboardScenes
        .map((_, sceneIndex) => sceneIndex)
        .filter((sceneIndex) => Boolean(imageUrls[sceneIndex]))
      const totalWeight = effectiveIndices.reduce(
        (sum, sceneIndex) =>
          sum + Math.max(1, storyboardScenes[sceneIndex]?.narration.replace(/\s/g, "").length || 1),
        0
      )
      const sceneWeight = Math.max(
        1,
        storyboardScenes[index]?.narration.replace(/\s/g, "").length || 1
      )
      const timestampDuration = getSceneTtsDurationSeconds(
        scriptLines,
        storyboardScenes[index]?.narration || "",
        index
      )
      const durationPerVideo = voiceLedTargetSeconds(
        timestampDuration ??
          Math.max(1, Math.round((totalTtsDuration * sceneWeight) / Math.max(1, totalWeight))),
        SHOPPING_VIDEO_MODEL_META[videoGenerationModel].maxDuration
      )
      
      // durationPerVideo가 유효한지 확인 (0보다 커야 함)
      if (!durationPerVideo || durationPerVideo <= 0) {
        throw new Error(`영상 길이 계산 오류: durationPerVideo=${durationPerVideo}초 (TTS: ${totalTtsDuration}초)`)
      }
      
      console.log(`[Shopping] 📝 ${sceneName} 프롬프트 준비 (${durationPerVideo}초)`)
      
      let videoPrompt: string
      try {
        console.log(`[Shopping] 🤖 ${sceneName} 프롬프트 생성 중...`)
      
        const savedPrompt = videoPrompts.get(index)?.trim()
        if (savedPrompt) {
          videoPrompt = savedPrompt
          console.log(`[Shopping] ✅ ${sceneName} 저장된 프롬프트 사용`)
        } else {
          videoPrompt =
            storyboardScenes[index]?.motionPrompt?.trim() ||
            (await generateVideoPromptFromScript(
            storyboardScenes[index]?.narration || "",
            productName,
            durationPerVideo,
            productDescription
          ))
          console.log(`[Shopping] ✅ ${sceneName} 프롬프트 생성 완료`)
          setVideoPrompts((prev) => {
            const newMap = new Map(prev)
            newMap.set(index, videoPrompt)
            return newMap
          })
        }
      } catch (error) {
        console.error(`[Shopping] ❌ ${sceneName} 프롬프트 생성 실패:`, error)
        setError(`${sceneName} 프롬프트 생성에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
        throw error
      } finally {
        setIsGeneratingVideoPrompts((prev) => {
          const newMap = new Map(prev)
          newMap.set(index, false)
          return newMap
        })
      }
      
      console.log(
        `[Shopping] 🎬 2단계: ${sceneName} ${SHOPPING_VIDEO_MODEL_META[videoGenerationModel].label} 영상 생성`
      )
      const imageUrl = imageUrls[index]
      if (!imageUrl) {
        throw new Error("해당 장면 이미지가 없습니다. AI이미지 단계에서 이미지를 준비해주세요.")
      }
      const videoUrl =
        index === 0
          ? await renderProductPhotoMaster(imageUrl, durationPerVideo, "right").catch(async (stillError) => {
              console.warn("[Shopping] 원본 제품 마스터 실패, AI 영상으로 대체:", stillError)
              return generateVideoWithSeedance(
                imageUrl,
                videoPrompt,
                durationPerVideo,
                replicateApiKey,
                videoGenerationModel
              )
            })
          : await generateVideoWithSeedance(
              imageUrl,
              videoPrompt,
              durationPerVideo,
              replicateApiKey,
              videoGenerationModel
            )
      
      console.log(`[Shopping] ✅ ${sceneName} 재생성 완료:`, videoUrl)
      
      // 변환된 영상 URL 저장 및 즉시 표시
      setConvertedVideoUrls((prev) => {
        const newMap = new Map(prev)
        newMap.set(index, videoUrl)
        return newMap
      })
      setSceneVideoAt(index, videoUrl)
      
    } catch (error) {
      console.error(`[Shopping] ❌ ${sceneName} 재생성 실패:`, error)
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

  const factoryPipelineScriptStartedRef = useRef(false)
  const factoryServerDownloadTriggeredRef = useRef<string | null>(null)
  const factoryPreviewAutoTriggeredRef = useRef<string | null>(null)

  // 자동화 모드: 해당 날짜 도래 시 수동으로 영상 생성 시작 (제작 화면으로 이동)
  const startFactoryPipeline = (item: FactoryScheduleItem) => {
    persistFactorySchedules(factorySchedules.map((s) => (s.id === item.id ? { ...s, status: "generating" as const } : s)))
    setProductName(item.productName)
    setProductDescription(item.productDescription || "")
    setProductImage(item.productImageBase64)
    setSelectedVoiceId(restorableVoiceId(item.voiceId))
    setShowFactoryView(false)
    setShowProjectList(false)
    setActiveStep("collect")
    setFactoryAutoRunItem(item)
    factoryPipelineScriptStartedRef.current = false
  }

  // 자동화 모드: 상품 클릭 시 수동 모드로 진입 (프로젝트 있으면 불러오기, 없으면 제품 정보만 로드). 썸네일은 AI 생성으로 설정.
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
          if (data.videoDuration) setVideoDuration(data.videoDuration as 12 | 15 | 20 | 30)
          if (typeof data.targetScriptSeconds === "number" && data.targetScriptSeconds > 0) {
            setTargetScriptSeconds(Math.max(10, Math.min(60, data.targetScriptSeconds)))
          }
          if (data.selectedScriptTemplateId) setSelectedScriptTemplateId(data.selectedScriptTemplateId)
          if (data.visualFocus) setVisualFocus(normalizeVisualFocus(data.visualFocus))
          if (data.scriptTitle) setScriptTitle(data.scriptTitle)
          if (data.storyboardScenes?.length) setStoryboardScenes(data.storyboardScenes)
          if (data.script) setScript(data.script)
          if (data.editedScript) setEditedScript(data.editedScript)
          if (data.selectedVoiceId) {
            setSelectedVoiceId(
              data.selectedVoiceId.startsWith("ttsmaker-")
                ? DEFAULT_VOICE_ID
                : restorableVoiceId(data.selectedVoiceId)
            )
          }
          if (data.selectedTypecastVoiceId) setSelectedTypecastVoiceId(data.selectedTypecastVoiceId)
          if (data.selectedTypecastEmotion) setSelectedTypecastEmotion(data.selectedTypecastEmotion)
          setTtsAudioUrl(data.ttsAudioUrl && data.ttsAudioUrl.trim() ? data.ttsAudioUrl : "")
          setSceneTtsTracks(data.sceneTtsTracks || [])
          setScriptLines(data.subtitleLines || [])
          if (data.imageUrls) setImageUrls(data.imageUrls)
          if (data.imagePrompts) {
            setImagePrompts(data.imagePrompts)
            setPromptsGenerated(data.imagePrompts.length > 0)
          }
          {
            const videoMap = new Map<number, string>()
            data.convertedVideoUrls?.forEach(({ index, videoUrl }) => {
              const trimmed = typeof videoUrl === "string" ? videoUrl.trim() : ""
              if (trimmed) videoMap.set(index, trimmed)
            })
            data.storyboardScenes?.forEach((scene, index) => {
              if (videoMap.has(index)) return
              const trimmed = typeof scene.videoUrl === "string" ? scene.videoUrl.trim() : ""
              if (trimmed) videoMap.set(index, trimmed)
            })
            setConvertedVideoUrls(videoMap)
          }
          if (data.videoUrl) setVideoUrl(data.videoUrl)
          if (data.subtitleStyle) setSubtitleStyle(normalizeShoppingSubtitleStyle(data.subtitleStyle))
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
          if (data.transitionDuration !== undefined) setTransitionDuration(0.04)
          if (data.youtubeTitle) setYoutubeTitle(data.youtubeTitle)
          if (data.youtubeDescription) setYoutubeDescription(data.youtubeDescription)
          if (data.youtubeTags) updateYoutubeTags(data.youtubeTags)
          if (data.thumbnailUrl) setThumbnailUrl(data.thumbnailUrl)
          if (data.thumbnailHookingText) setThumbnailHookingText(data.thumbnailHookingText)
          setThumbnailStudioDesign(data.thumbnailStudioDesign || null)
          if (data.thumbnailImages) setThumbnailImages(data.thumbnailImages)
          if (data.selectedThumbnailIndex !== undefined) setSelectedThumbnailIndex(data.selectedThumbnailIndex)
          setActiveStep(migrateVer2ActiveStep(data.activeStep, !!(data.script || data.editedScript)))
          setCurrentProject(project)
        } else {
          setProductName(item.productName)
          setProductDescription(item.productDescription || "")
          setProductImage(item.productImageBase64)
          setSelectedVoiceId(restorableVoiceId(item.voiceId))
          setActiveStep("collect")
          setCurrentProject(null)
        }
      } catch (err) {
        console.warn("[Factory] 프로젝트 불러오기 실패, 제품 정보만 로드:", err)
        setProductName(item.productName)
        setProductDescription(item.productDescription || "")
        setProductImage(item.productImageBase64)
        setSelectedVoiceId(restorableVoiceId(item.voiceId))
        setActiveStep("collect")
        setCurrentProject(null)
      }
    } else {
      setProductName(item.productName)
      setProductDescription(item.productDescription || "")
      setProductImage(item.productImageBase64)
      setSelectedVoiceId(restorableVoiceId(item.voiceId))
      setActiveStep("collect")
      setCurrentProject(null)
    }
    setShowFactoryView(false)
    setShowProjectList(false)
  }

  // 자동화 모드: 백그라운드에서 전체 파이프라인 실행 (화면 전환 없이 자동화 모드에 머물며 진행 상황만 표시)
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
          openaiKey,
          item.visualFocus || visualFocus
        )
      } catch (promptErr) {
        console.warn("[Factory] 이미지 프롬프트 생성 실패, 장면 텍스트로 대체:", promptErr)
      }
      const imageUrls: string[] = []
      let factoryCharacterRef: string | undefined
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
          "nano-banana",
          "product-recompose",
          openaiKey,
          factoryCharacterRef,
          item.visualFocus || visualFocus
        )
        imageUrls.push(url)
        if (
          !factoryCharacterRef &&
          /인물|여성|남성|person|woman|man|face|korean/i.test(promptToUse || "")
        ) {
          factoryCharacterRef = url
        }
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
          body: JSON.stringify({
            text: ttsText,
            voice: voiceName,
            speed: resolveTtsSpeed("ttsmaker"),
            pitch,
            apiKey: ttsmakerKey,
          }),
        })
      } else if (voiceId.startsWith("supertonic-")) {
        const sid = voiceId.replace("supertonic-", "")
        ttsResponse = await fetchSupertonicTts({
          text: ttsText,
          voiceId: sid,
          lang: "ko",
          speed: resolveTtsSpeed("supertonic"),
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
          body: JSON.stringify({
            text: ttsText,
            voiceId: eid,
            apiKey: elevenKey,
            speed: resolveTtsSpeed("elevenlabs"),
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
          updatePhase("tts", "failed", "타입캐스트 API 키가 없습니다.")
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
            speed: resolveTtsSpeed("typecast"),
          }),
        })
      } else if (voiceId.startsWith("adam-")) {
        ttsResponse = await fetchAdamTts({
          text: ttsText,
          tempo: resolveTtsSpeed("adam"),
        })
      } else if (voiceId.startsWith("gemini-")) {
        ttsResponse = await fetch("/api/ai-shopping/gemini-tts", {
          method: "POST",
          // 배포 서버는 Gemini 키를 파일에 저장하지 않으므로 수강생 본인 키를 요청마다 보낸다 (geminiApiKey()가 이 헤더를 먼저 읽음)
          headers: { "Content-Type": "application/json", "x-wings-gemini-key": localStorage.getItem("shotform_gemini_api_key")?.trim() || "" },
          body: JSON.stringify({
            text: ttsText,
            voiceId: voiceId.replace("gemini-", ""),
            speed: resolveTtsSpeed("gemini"),
          }),
        })
      } else {
        updatePhase(
          "tts",
          "failed",
          isRetiredSupertoneVoiceId(voiceId) ? RETIRED_SUPERTONE_MESSAGE : "지원하지 않는 목소리입니다."
        )
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
          ttsAudioUrlForProject = await uploadTtsBlobToStorage(wavBlob, userId, projectId)
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
        subtitles.push(...getSubtitlePhraseRanges(phrases, startSec, endSec))
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
          {
            url: gcsVideoUrls[1],
            startTime: durationPerVideo,
            endTime: durationPerVideo * 2,
            transition: { type: "fade", duration: transitionDuration },
          },
          {
            url: gcsVideoUrls[2],
            startTime: durationPerVideo * 2,
            endTime: durationSec,
            transition: { type: "fade", duration: transitionDuration },
          },
        ],
        transitionEffect: "fade",
        transitionDuration,
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
      const channelName = typeof window !== "undefined" ? localStorage.getItem("shopping_v2_factory_youtube_channel") : null
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
          const clientId = typeof window !== "undefined" ? localStorage.getItem("shopping_v2_factory_youtube_client_id") : null
          const clientSecret = typeof window !== "undefined" ? localStorage.getItem("shopping_v2_factory_youtube_client_secret") : null
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

  // 자동화 모드 큐: 한 번에 하나씩만 백그라운드 파이프라인 실행 (순차 처리)
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
    if (!factoryAutoRunItem || factoryPipelineScriptStartedRef.current || activeStep !== "collect") return
    if (!productName) return
    factoryPipelineScriptStartedRef.current = true
    handleGenerateScript()
  }, [factoryAutoRunItem, activeStep, productName])

  // 자동화 모드: 썸네일 준비되면 자동으로 미리보기 단계로 이동 (버튼 클릭 없이)
  useEffect(() => {
    if (!factoryAutoRunItem || activeStep !== "preview") return
    const thumbReady = thumbnailUrl || thumbnailImages.length > 0
    if (!thumbReady || convertedVideoUrls.size !== 3 || !ttsAudioUrl) return
    setActiveStep("preview")
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 자동 진행용
  }, [factoryAutoRunItem?.id, activeStep, thumbnailUrl, thumbnailImages.length, convertedVideoUrls.size, ttsAudioUrl])

  // 자동화 모드: 미리보기 단계 진입 시 미리보기 생성 자동 실행 (한 번만)
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

  // 자동화 모드: 미리보기 생성 완료 시 서버 다운로드(렌더) 자동 시작 (한 번만)
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
      case "keywordAnalysis":
        return (
          <KeywordAnalysisStep
            snapshot={keywordAnalysis}
            onSnapshotChange={setKeywordAnalysis}
            onNext={() => setActiveStep("collect")}
          />
        )

      case "collect":
        return (
          <div className="space-y-6">
            <Card className="border border-white/10 rounded-2xl shadow-2xl bg-[#fdfeff] overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent"></div>
              <CardHeader className="pb-4 relative z-10 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-400/25 shadow-sm">
                    <ShoppingBag className="w-5 h-5 text-orange-300" />
                  </div>
                  <CardTitle className="text-xl font-bold text-zinc-100">
                    2단계 · 제품 서칭
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 py-6 relative z-10">
                <div className="flex flex-col gap-3 rounded-xl border border-sky-400/20 bg-sky-500/[0.06] p-3 sm:flex-row sm:items-center">
                  {keywordAnalysis?.selectedKeyword || selectedKeywordProduct ? (
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-sky-300">키워드 분석에서 전달됨</p>
                      <p className="truncate text-sm font-semibold text-zinc-100">
                        {selectedKeywordProduct?.productName || keywordAnalysis?.selectedKeyword}
                      </p>
                    </div>
                  ) : (
                    <p className="flex-1 text-xs text-zinc-500">이전 단계에서 키워드나 상품을 먼저 선택할 수 있습니다.</p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveStep("keywordAnalysis")}
                    className="border-white/15 bg-[#fcffff] text-zinc-200 hover:bg-white/10"
                  >
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    이전 · 키워드 분석
                  </Button>
                </div>

                {/* 수집 방식 선택 */}
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-black/40 border border-white/10">
                  <button
                    type="button"
                    onClick={() => setCollectMode("collector")}
                    className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                      collectMode === "collector"
                        ? "bg-orange-500 text-white shadow"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                    }`}
                  >
                    수집기로 불러오기
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCollectMode("manual")
                      setDetailInsights(null)
                    }}
                    className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                      collectMode === "manual"
                        ? "bg-orange-500 text-white shadow"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                    }`}
                  >
                    제품명·리뷰 직접 입력
                  </button>
                </div>

                {collectMode === "collector" ? (
                  <CoupangReviewPanel
                    onApplyCollected={(data) => {
                      setCollectMode("collector")
                      if (data.productName) setProductName(data.productName)
                      setProductPrice("")
                      setProductDelivery("")
                      setProductDescription("")
                      setDetailInsights(null)
                      setReviewInsights(null)
                      const details = data.detailImages || []
                      // CoupangReviewPanel에서 AI가 고른 1·2번 (이미 최대 2장)
                      const photos = (data.productImages || data.images || []).slice(0, 2)
                      setDetailImages(details)
                      setProductImages(photos)
                      const nextImage = data.productImage || photos[0] || null
                      if (nextImage) {
                        setProductImage(nextImage)
                        const img = new Image()
                        img.onload = () => {
                          if (img.width > 0 && img.height > 0) {
                            setProductImageAspectRatio(img.width / img.height)
                          }
                        }
                        img.src = nextImage
                      } else {
                        setProductImage(null)
                        setProductImageAspectRatio(null)
                      }
                      setReviews(
                        data.reviews.map((r, i) => {
                          const meta = resolveReviewPageMeta(r, i)
                          return {
                            author: r.author,
                            rating: r.rating,
                            content: r.content,
                            date: r.date,
                            page: meta.page,
                            indexOnPage: meta.indexOnPage,
                            images: normalizeReviewImageUrls(r.images),
                          }
                        })
                      )
                      const collectedReviewImages = normalizeReviewImageUrls([
                        ...(data.reviewImages || []),
                        ...data.reviews.flatMap((review) => review.images || []),
                      ])
                      setReviewImages(collectedReviewImages)
                      setReviewListPage(1)
                      setProductJson(
                        JSON.stringify(
                          {
                            productName: data.productName || productName,
                            productImages: photos,
                            images: photos,
                            detailImages: details,
                            productImage: nextImage || undefined,
                            reviewImages: collectedReviewImages,
                            reviews: data.reviews,
                          },
                          null,
                          2
                        )
                      )
                    }}
                  />
                ) : (
                  <div className="space-y-3 rounded-xl border border-sky-400/25 bg-sky-500/5 p-4">
                    <div className="flex items-start gap-2">
                      <ClipboardPaste className="w-4 h-4 text-sky-300 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">직접 붙여넣기</p>
                        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                          제품명·제품 이미지·리뷰를 직접 넣습니다. 상세페이지가 없어 상세 분석은
                          비활성화되고, 리뷰 분석과 제품 이미지는 다음 단계에서 사용됩니다.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <Label
                    htmlFor="product-name"
                    className="text-sm font-semibold text-zinc-300 flex items-center gap-2"
                  >
                    제품명 <span className="text-red-500">*</span>
                  </Label>
                  <p className="text-xs text-zinc-500">예: 무선 블루투스 이어폰</p>
                  <Input
                    id="product-name"
                    placeholder="제품명을 입력해주세요"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="h-12 bg-black/40 border-white/15 text-zinc-100 placeholder:text-zinc-600 focus:border-orange-400 focus:ring-orange-400/20 shadow-sm"
                  />
                </div>

                {collectMode === "manual" ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label
                          htmlFor="manual-product-photos"
                          className="text-sm font-semibold text-zinc-300 flex items-center gap-2"
                        >
                          제품 이미지 <span className="text-red-500">*</span>
                          {productImages.length > 0 ? (
                            <span className="text-xs font-normal text-zinc-500">
                              ({productImages.length}장)
                            </span>
                          ) : null}
                        </Label>
                        {productImages.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setProductImages([])
                              setProductImage(null)
                              setProductImageFile(null)
                              setProductImageAspectRatio(null)
                            }}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            전체 삭제
                          </button>
                        ) : null}
                      </div>
                      <p className="text-xs text-zinc-500">
                        다음 단계(이미지·썸네일 등)에서 쓰일 제품 사진을 올려 주세요. 여러 장
                        가능합니다.
                      </p>
                      <input
                        type="file"
                        id="manual-product-photos"
                        accept="image/*"
                        multiple
                        onChange={handleProductPhotoUpload}
                        className="hidden"
                      />
                      {productImages.length === 0 ? (
                        <div
                          className={`border-dashed border-2 rounded-2xl p-6 text-center transition-all ${
                            isDragging
                              ? "border-sky-400/50 bg-sky-500/15"
                              : "border-white/15 bg-white/[0.03] hover:border-sky-400/40"
                          }`}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleProductPhotoDrop}
                        >
                          <label
                            htmlFor="manual-product-photos"
                            className="cursor-pointer flex flex-col items-center gap-3"
                          >
                            <ImageIcon className="w-9 h-9 text-sky-300/90" />
                            <span className="text-sm text-zinc-300 font-medium">
                              제품 이미지를 업로드하세요
                            </span>
                            <span className="text-xs text-zinc-500">
                              클릭 또는 드래그 · PNG, JPG (장당 최대 10MB)
                            </span>
                          </label>
                        </div>
                      ) : (
                        <div
                          className="rounded-xl border border-sky-400/25 bg-black/40 p-3"
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleProductPhotoDrop}
                        >
                          <div className="flex flex-wrap gap-2">
                            {productImages.map((url, i) => (
                              <div
                                key={`manual-prod-${i}`}
                                className="group relative w-28 sm:w-32 aspect-square rounded-xl overflow-hidden border border-white/10 bg-black/50"
                              >
                                <div className="absolute top-1 left-1 z-10 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-semibold text-sky-200">
                                  {i + 1}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRemoveProductImageAt(i)
                                  }}
                                  className="absolute top-1 right-1 z-10 p-1 bg-red-600/90 text-white rounded-full"
                                  aria-label={`제품 이미지 ${i + 1} 제거`}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setImagePreview({
                                      urls: productImages,
                                      index: i,
                                      title: "제품 이미지",
                                    })
                                  }
                                  className="absolute inset-0 z-[1]"
                                  aria-label={`제품 이미지 ${i + 1} 확대`}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={url}
                                    alt={`제품 이미지 ${i + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/35 group-hover:opacity-100">
                                    <ZoomIn className="h-5 w-5 text-white drop-shadow" />
                                  </span>
                                </button>
                              </div>
                            ))}
                            <label
                              htmlFor="manual-product-photos"
                              className="w-28 sm:w-32 aspect-square rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center gap-1 cursor-pointer text-zinc-500 hover:border-sky-400/50 hover:text-sky-200"
                            >
                              <Plus className="w-5 h-5" />
                              <span className="text-[10px]">추가</span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-semibold text-zinc-300">
                        리뷰 붙여넣기 <span className="text-red-500">*</span>
                      </Label>
                      <p className="text-xs text-zinc-500">
                        리뷰를 한 줄씩 또는 빈 줄로 구분해서 붙여 넣은 뒤 「리뷰 적용」을 누르세요.
                      </p>
                      <Textarea
                        value={manualReviewPaste}
                        onChange={(e) => setManualReviewPaste(e.target.value)}
                        rows={8}
                        placeholder={"예:\n달콤하고 과즙이 많아요\n\n씨도 적고 아이 간식으로 좋아요"}
                        className="text-sm resize-none bg-black/40 border-white/15 text-zinc-100 placeholder:text-zinc-600"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          const parsed = parsePastedReviews(manualReviewPaste)
                          if (!parsed.length) {
                            alert(
                              "붙여넣은 리뷰를 인식하지 못했습니다. 한 줄에 한 리뷰씩 넣어 주세요."
                            )
                            return
                          }
                          setCollectMode("manual")
                          setDetailImages([])
                          setDetailInsights(null)
                          setReviewInsights(null)
                          setReviews(parsed)
                          setReviewListPage(1)
                          setProductJson(
                            JSON.stringify(
                              {
                                productName,
                                productImages,
                                productImage: productImages[0] || productImage || undefined,
                                reviews: parsed,
                                collectMode: "manual",
                              },
                              null,
                              2
                            )
                          )
                        }}
                        className="bg-sky-500 hover:bg-sky-400 text-white"
                      >
                        <ClipboardPaste className="w-3.5 h-3.5 mr-1.5" />
                        리뷰 적용
                      </Button>
                    </div>
                  </>
                ) : null}

                {collectMode === "collector" ? (
                  <div className="space-y-5">
                    {/* 제품 사진 (최대 2장) — 상세페이지 위 */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                        제품 사진
                        {productImages.length > 0 ? (
                          <span className="text-xs font-normal text-zinc-500">
                            ({productImages.length}/2장 · AI가 제품이 잘 보이는 순)
                          </span>
                        ) : null}
                      </Label>
                      {productImages.length > 0 ? (
                        <div className="flex gap-2">
                          {productImages.map((url, i) => (
                            <div
                              key={`prod-${url.slice(0, 40)}-${i}`}
                              className="group relative w-28 sm:w-32 aspect-square rounded-xl overflow-hidden border border-emerald-400/30 bg-black/50 shrink-0"
                            >
                              <div className="absolute top-1 left-1 z-10 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-200">
                                제품 {i + 1}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRemoveProductImageAt(i)
                                }}
                                className="absolute top-1 right-1 z-10 p-1 bg-red-600/90 text-white rounded-full"
                                aria-label={`제품사진 ${i + 1} 제거`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setImagePreview({
                                    urls: productImages,
                                    index: i,
                                    title: "제품 사진",
                                  })
                                }
                                className="absolute inset-0 z-[1]"
                                aria-label={`제품사진 ${i + 1} 확대`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={url}
                                  alt={`제품사진 ${i + 1}`}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/35 group-hover:opacity-100">
                                  <ZoomIn className="h-5 w-5 text-white drop-shadow" />
                                </span>
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-600 rounded-lg border border-dashed border-white/10 px-3 py-4 text-center">
                          수집기로 불러오면 갤러리 전체를 보고 AI가 고른 제품 사진 최대 2장이
                          여기에 표시됩니다. 클릭하면 확대됩니다.
                        </p>
                      )}
                    </div>

                    {/* 상세페이지 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label
                          htmlFor="detail-page-images"
                          className="text-sm font-semibold text-zinc-300 flex items-center gap-2"
                        >
                          상세페이지
                          {detailImages.length > 0 ? (
                            <span className="text-xs font-normal text-zinc-500">
                              ({detailImages.length}장)
                            </span>
                          ) : null}
                        </Label>
                        {(detailImages.length > 0 || productImages.length > 0) && (
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor="detail-page-images"
                              className="text-xs text-amber-200/90 cursor-pointer hover:text-amber-100 underline-offset-2 hover:underline"
                            >
                              상세 추가
                            </label>
                            <button
                              type="button"
                              onClick={handleRemoveImage}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              전체 삭제
                            </button>
                          </div>
                        )}
                      </div>

                      <input
                        type="file"
                        id="detail-page-images"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                      />

                      {detailImages.length === 0 ? (
                        <div
                          className={`border-dashed border-2 rounded-2xl p-6 text-center transition-all duration-300 ${
                            isDragging
                              ? "border-orange-400/50 bg-orange-500/15"
                              : "border-white/15 bg-white/[0.03] hover:border-orange-400/40"
                          }`}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                        >
                          <label
                            htmlFor="detail-page-images"
                            className="cursor-pointer flex flex-col items-center gap-3"
                          >
                            <ImageIcon className="w-8 h-8 text-orange-300/80" />
                            <span className="text-xs text-zinc-400">
                              수집기로 불러오거나 상세페이지 이미지를 업로드하세요
                            </span>
                          </label>
                        </div>
                      ) : (
                        <div
                          className="rounded-xl border border-orange-400/25 bg-black/40 p-3"
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                        >
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-56 overflow-y-auto pr-0.5">
                            {detailImages.map((url, i) => (
                              <div
                                key={`${url.slice(0, 48)}-${i}`}
                                className="group relative aspect-[3/4] rounded-lg overflow-hidden border border-white/10 bg-black/50"
                              >
                                <div className="absolute top-1 left-1 z-10 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200">
                                  {i + 1}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRemoveDetailImageAt(i)
                                  }}
                                  className="absolute top-1 right-1 z-10 p-1 bg-red-600/90 text-white rounded-full"
                                  aria-label={`상세 ${i + 1} 제거`}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setImagePreview({
                                      urls: detailImages,
                                      index: i,
                                      title: "상세페이지",
                                    })
                                  }
                                  className="absolute inset-0 z-[1]"
                                  aria-label={`상세페이지 ${i + 1} 확대`}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={url}
                                    alt={`상세페이지 ${i + 1}`}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/35 group-hover:opacity-100">
                                    <ZoomIn className="h-5 w-5 text-white drop-shadow" />
                                  </span>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {reviewImages.length > 0 ? (
                  <div className="space-y-3 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/[0.06] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-300/80">
                          Review Photos
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-zinc-100">
                          리뷰 사진 {reviewImages.length}장
                        </p>
                      </div>
                      <p className="text-[10px] text-zinc-500">
                        클릭하면 원본 크기로 확인할 수 있습니다.
                      </p>
                    </div>
                    <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto pr-0.5 sm:grid-cols-4 md:grid-cols-6">
                      {reviewImages.map((url, index) => (
                        <button
                          key={`${url.slice(0, 48)}-${index}`}
                          type="button"
                          onClick={() =>
                            setImagePreview({
                              urls: reviewImages,
                              index,
                              title: "리뷰 사진",
                            })
                          }
                          className="group relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-black/50"
                          aria-label={`리뷰 사진 ${index + 1} 확대`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`리뷰 사진 ${index + 1}`}
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <span className="absolute left-1 top-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-semibold text-fuchsia-100">
                            {index + 1}
                          </span>
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/35 group-hover:opacity-100">
                            <ZoomIn className="h-5 w-5 text-white drop-shadow" />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* 리뷰 목록 — 벤치마킹형: N페이지 · M번 */}
                <div className="space-y-3 pt-2">
                  {(() => {
                    const perPage = COUPANG_REVIEWS_PER_PAGE
                    const total = reviews.length
                    const totalPages = Math.max(1, Math.ceil(total / perPage) || 1)
                    const page = Math.min(Math.max(1, reviewListPage), totalPages)
                    const start = (page - 1) * perPage
                    const end = Math.min(start + perPage, total)
                    const slice = reviews.slice(start, end)

                    return (
                      <div className="rounded-2xl border border-white/[0.08] bg-[#f3feff] p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300/75">
                              Review List
                            </p>
                            <p className="text-sm font-semibold text-zinc-100 mt-0.5">
                              {total > 0 ? `${start + 1}-${end} / ${total}` : `0 / 0`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleAddReview}
                              className="border-amber-400/35 text-amber-100 hover:bg-amber-500/15"
                            >
                              <Plus className="w-3.5 h-3.5 mr-1" />
                              리뷰 추가
                            </Button>
                            {total > 0 ? (
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={page <= 1}
                                  onClick={() => setReviewListPage((p) => Math.max(1, p - 1))}
                                  className="h-8 w-8 p-0 text-zinc-400"
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                </Button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                  .slice(0, 8)
                                  .map((n) => (
                                    <button
                                      key={n}
                                      type="button"
                                      onClick={() => setReviewListPage(n)}
                                      className={`h-8 min-w-8 px-2 rounded-md text-xs font-semibold transition-colors ${
                                        n === page
                                          ? "bg-amber-400 text-[#f3feff]"
                                          : "bg-white/5 text-zinc-400 hover:bg-white/10"
                                      }`}
                                    >
                                      {n}
                                    </button>
                                  ))}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={page >= totalPages}
                                  onClick={() =>
                                    setReviewListPage((p) => Math.min(totalPages, p + 1))
                                  }
                                  className="h-8 w-8 p-0 text-zinc-400"
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {total === 0 ? (
                          <p className="text-xs text-zinc-500">
                            {collectMode === "manual"
                              ? "위에서 리뷰를 붙여 넣고 「리뷰 적용」을 누르세요."
                              : "수집기로 불러오거나 리뷰를 추가하세요."}
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {slice.map((review, offset) => {
                              const index = start + offset
                              const meta = resolveReviewPageMeta(review, index)
                              return (
                                <div
                                  key={index}
                                  className="rounded-xl border border-white/[0.07] bg-[#f4ffff] px-3.5 py-3 space-y-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[13px] font-semibold text-amber-300">
                                      {formatReviewPageLabel(meta.page, meta.indexOnPage)}
                                    </p>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRemoveReview(index)}
                                      className="h-7 px-2 text-red-400 shrink-0"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                  <Textarea
                                    placeholder="리뷰 내용"
                                    value={review.content}
                                    onChange={(e) =>
                                      handleUpdateReview(index, { content: e.target.value })
                                    }
                                    rows={3}
                                    className="text-[12.5px] leading-relaxed resize-none bg-black/30 border-white/10 text-zinc-100"
                                  />
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>

                {/* 맨 아래: 상세+리뷰 합친 대본 전 정보 정리 */}
                <div className="pt-2 border-t border-white/10">
                  <CollectBriefingPanel
                    productName={productName}
                    detailImages={detailImages}
                    productImage={productImage}
                    reviews={reviews}
                    detailDisabled={collectMode === "manual"}
                    detailInsights={detailInsights}
                    reviewInsights={reviewInsights}
                    onDetailInsights={setDetailInsights}
                    onReviewInsights={setReviewInsights}
                  />
                </div>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-red-400">
                      <X className="w-4 h-4" />
                      <span className="text-sm font-medium">{error}</span>
                    </div>
                  </div>
                )}

                {(() => {
                  const hasReviews = reviews.some((r) => r.content.trim().length >= 4)
                  const hasDetailMedia =
                    detailImages.length > 0 ||
                    productImages.length > 0 ||
                    Boolean(productImage)
                  const hasHttpDetails =
                    detailImages.some((u) => u.startsWith("http")) ||
                    Boolean(productImage?.startsWith("http"))
                  const detailReady =
                    collectMode === "manual" ||
                    !hasHttpDetails ||
                    Boolean(detailInsights)
                  const hasProductPhoto =
                    productImages.length > 0 || Boolean(productImage)
                  const canApplyInsights =
                    Boolean(productName.trim()) &&
                    hasReviews &&
                    Boolean(reviewInsights) &&
                    detailReady &&
                    (collectMode === "manual"
                      ? hasProductPhoto
                      : hasDetailMedia)

                  return (
                    <>
                      <Button
                        onClick={() => setActiveStep("scriptJson")}
                        disabled={!canApplyInsights}
                        className="w-full h-16 text-base md:text-lg bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:via-orange-400 hover:to-amber-400 text-[#f3feff] font-extrabold rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-amber-500/40 hover:shadow-xl hover:shadow-amber-500/50"
                        size="lg"
                      >
                        <Wand2 className="w-6 h-6 mr-2.5" />
                        대본 생성에 자동 반영
                      </Button>
                      <p className="text-xs text-center text-zinc-500 -mt-2">
                        {!productName.trim()
                          ? "제품명을 입력해 주세요."
                          : collectMode === "manual" && !hasProductPhoto
                            ? "제품 이미지를 올려 주세요. (다음 단계에서 사용)"
                            : !hasReviews
                              ? "리뷰를 넣어 주세요."
                              : collectMode === "collector" && !hasDetailMedia
                                ? "상세페이지를 불러와 주세요."
                                : !reviewInsights ||
                                    (collectMode === "collector" &&
                                      hasHttpDetails &&
                                      !detailInsights)
                                  ? "「제품 분석하기」를 눌러 분석을 완료해 주세요."
                                  : "위 분석 결과가 다음 대본생성 단계에 포함됩니다."}
                      </p>
                    </>
                  )
                })()}
              </CardContent>
            </Card>
          </div>
        )

      case "scriptJson": {
        const charTarget = targetCharCountForSeconds(targetScriptSeconds)
        const spokenLen = (editedScript || script).replace(/\s/g, "").length
        const lengthPct = Math.min(100, Math.round((spokenLen / Math.max(1, charTarget)) * 100))
        const selectedTpl =
          SHOTFORM_SCRIPT_TEMPLATES.find((t) => t.id === selectedScriptTemplateId) ||
          SHOTFORM_SCRIPT_TEMPLATES[0]

        return (
          <div className="space-y-6">
            <Card className="border border-white/10 rounded-2xl shadow-2xl bg-[#fdfeff] overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent pointer-events-none" />
              <CardHeader className="pb-4 relative z-10 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-400/25 shadow-sm">
                    <FileText className="w-5 h-5 text-orange-300" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-zinc-100">
                      3단계 · 대본 생성
                    </CardTitle>
                    <p className="text-xs text-zinc-500 mt-1">
                      비주얼 포커스·템플릿을 고른 뒤 대본을 만들고, 아래에서 이미지 장면·영상 프롬프트를 검토하세요.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 py-5 space-y-5">
                {/* 비주얼 포커스 — 대본 생성 전 필수 선택 */}
                <div className="rounded-xl border border-white/10 bg-[#f3feff] overflow-hidden">
                  <div className="px-3.5 py-3 border-b border-white/[0.06]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300/70">
                      Visual Focus
                    </p>
                    <p className="text-sm font-semibold text-zinc-100 mt-0.5">
                      이미지·영상 포커스
                      <span className="ml-1.5 text-xs font-normal text-zinc-500">
                        대본 만들기 전에 선택 · 이미지 장면·영상 프롬프트에 반영
                      </span>
                    </p>
                  </div>
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {SHOTFORM_VISUAL_FOCUS_OPTIONS.map((opt) => {
                      const on = visualFocus === opt.id
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setVisualFocus(opt.id)}
                          className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                            on
                              ? "border-sky-400/50 bg-sky-500/15"
                              : "border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                on
                                  ? "border-sky-300 bg-sky-400 text-[#efffff]"
                                  : "border-zinc-600"
                              }`}
                            >
                              {on ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-zinc-100 leading-snug">
                                {opt.label}
                              </p>
                              <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                                {opt.blurb}
                              </p>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 목표 길이 + 생성 CTA */}
                <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-4 space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="min-w-[220px] flex-1 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-sm font-semibold text-zinc-200">
                          목표 길이
                        </Label>
                        <span className="text-sm font-semibold tabular-nums text-amber-200">
                          {targetScriptSeconds}초
                          <span className="ml-2 text-xs font-normal text-zinc-500">
                            ≈ {charTarget}자 · 장면 {sceneCountForSeconds(targetScriptSeconds)}
                          </span>
                        </span>
                      </div>
                      <Slider
                        min={10}
                        max={60}
                        step={1}
                        value={[targetScriptSeconds]}
                        onValueChange={(v) => {
                          const sec = Array.isArray(v) ? v[0] : 30
                          setTargetScriptSeconds(sec)
                          syncVideoDurationFromSeconds(sec)
                        }}
                        className="w-full"
                      />
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all"
                          style={{
                            width: `${((targetScriptSeconds - 10) / 50) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={() => void handleGenerateScript()}
                      disabled={isGeneratingScript || !productName.trim()}
                      className="shrink-0 bg-emerald-500 hover:bg-emerald-400 text-[#eafef2] font-bold shadow-lg shadow-emerald-500/30"
                      size="lg"
                    >
                      {isGeneratingScript ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          대본 만드는 중…
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          대본 만들기
                        </>
                      )}
                    </Button>
                  </div>
                  {script ? (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-zinc-500">
                        <span>생성 대본 분량</span>
                        <span className="tabular-nums">
                          {spokenLen} / {charTarget}자 ({lengthPct}%)
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className={`h-full rounded-full transition-all ${
                            lengthPct > 115
                              ? "bg-orange-400"
                              : lengthPct < 85
                                ? "bg-sky-400"
                                : "bg-emerald-400"
                          }`}
                          style={{ width: `${Math.min(100, lengthPct)}%` }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* 템플릿 — 2열 그리드 */}
                <div className="rounded-xl border border-white/10 bg-[#f3feff] overflow-hidden">
                  <div className="px-3.5 py-3 border-b border-white/[0.06] flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300/70">
                        Templates
                      </p>
                      <p className="text-sm font-semibold text-zinc-100 mt-0.5">
                        대본 스타일
                        <span className="ml-1.5 text-xs font-normal text-zinc-500">
                          {SHOTFORM_SCRIPT_TEMPLATES.length}개 · 1개만 선택
                        </span>
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTemplateManager(true)}
                      className="shrink-0 h-8 border-sky-400/35 text-sky-200 bg-sky-500/10 hover:bg-sky-500/20"
                    >
                      <FolderOpen className="h-3.5 w-3.5 mr-1" />
                      템플릿 관리
                    </Button>
                  </div>
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {SHOTFORM_SCRIPT_TEMPLATES.map((tpl) => {
                      const on = tpl.id === selectedScriptTemplateId
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => setSelectedScriptTemplateId(tpl.id)}
                          onDoubleClick={() => setShowTemplateManager(true)}
                          className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                            on
                              ? "border-sky-400/50 bg-sky-500/15"
                              : "border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                on
                                  ? "border-sky-300 bg-sky-400 text-[#efffff]"
                                  : "border-zinc-600"
                              }`}
                            >
                              {on ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-[13px] font-semibold text-zinc-100 leading-snug">
                                  {tpl.name}
                                </p>
                                {on ? (
                                  <span className="shrink-0 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-200">
                                    적용됨
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                                {tpl.blurb}
                              </p>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  <p className="px-3.5 py-2.5 text-[10px] text-zinc-600 border-t border-white/[0.06] leading-relaxed">
                    선택: {selectedTpl.name}. 대본 스타일은 하나만 선택할 수 있으며, 기본값은
                    「일상 솔직후기형」입니다.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-5">
                  {/* 워크스페이스 */}
                  <div className="rounded-xl border border-white/10 bg-[#f3feff] overflow-hidden min-w-0">
                    <div className="px-4 py-3 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300/70">
                          Workspace
                        </p>
                        <p className="text-sm font-semibold text-zinc-100 mt-0.5">
                          대본 · 장면 프롬프트
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {script ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            생성됨
                          </span>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!script}
                          onClick={() =>
                            navigator.clipboard?.writeText(editedScript || script)
                          }
                          className="h-8 border-white/15 bg-[#fcffff] text-zinc-200 hover:bg-white/10 hover:text-white disabled:bg-[#fbfeff] disabled:text-zinc-600"
                        >
                          <Copy className="h-3.5 w-3.5 mr-1" />
                          복사
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 space-y-4">
                      {error ? (
                        <div className="p-3 rounded-lg border border-red-400/30 bg-red-500/10 text-sm text-red-300">
                          {error}
                        </div>
                      ) : null}

                      {!script && !isGeneratingScript ? (
                        <div className="rounded-xl border border-dashed border-white/10 px-4 py-12 text-center">
                          <p className="text-sm text-zinc-400">아직 대본이 없습니다</p>
                          <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed">
                            「{selectedTpl.name}」템플릿과 목표 길이를 확인한 뒤 「대본 만들기」를
                            눌러 주세요.
                          </p>
                        </div>
                      ) : null}

                      {isGeneratingScript ? (
                        <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 px-4 py-10 text-center">
                          <Loader2 className="mx-auto h-7 w-7 animate-spin text-amber-300" />
                          <p className="mt-3 text-sm font-medium text-amber-100">
                            {selectedTpl.name} 템플릿으로 대본·장면을 준비하는 중…
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            대본 작성 후 IMAGE/MOTION을 상업용 수준으로 다듬습니다
                          </p>
                        </div>
                      ) : null}

                      {script && !isGeneratingScript ? (
                        <>
                          {scriptTitle ? (
                            <div className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] px-3 py-2.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/80">
                                Draft title
                              </p>
                              <p className="text-sm font-semibold text-zinc-50 mt-0.5 leading-snug">
                                {scriptTitle}
                              </p>
                            </div>
                          ) : null}

                          <Collapsible defaultOpen={false}>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <Label className="text-xs font-semibold text-zinc-400">
                                전체 spoken 대본
                              </Label>
                              <CollapsibleTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-zinc-400"
                                >
                                  펼치기/접기
                                  <ChevronDown className="ml-1 h-3.5 w-3.5" />
                                </Button>
                              </CollapsibleTrigger>
                            </div>
                            <CollapsibleContent>
                              <Textarea
                                value={isEditingScript ? editedScript : script}
                                onChange={(e) => {
                                  setIsEditingScript(true)
                                  setEditedScript(e.target.value)
                                  setScript(e.target.value)
                                }}
                                rows={5}
                                className="text-sm bg-black/40 border-white/15 resize-none"
                              />
                              <div className="mt-2 flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="border-white/15 text-zinc-300"
                                  onClick={handleSaveEditedScript}
                                >
                                  대본 저장
                                </Button>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>

                          {isAnalyzingScript ? (
                            <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              대본 파트 보조 분석 중…
                            </p>
                          ) : null}

                          <div className="space-y-3">
                            <p className="text-xs font-semibold text-zinc-400">
                              장면 ({storyboardScenes.length})
                            </p>
                            {storyboardScenes.length === 0 ? (
                              <p className="text-xs text-zinc-600">
                                장면이 비어 있습니다. 다시 「대본 만들기」를 눌러 주세요.
                              </p>
                            ) : (
                              storyboardScenes.map((scene) => {
                                const editing = editingSceneId === scene.id
                                return (
                                  <div
                                    key={scene.id}
                                    className="rounded-xl border border-white/10 bg-[#f4ffff] p-3.5 space-y-3"
                                  >
                                    <div className="flex items-center justify-end gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 border-amber-400/30 bg-amber-500/10 text-xs text-amber-100 hover:bg-amber-500/20 hover:text-amber-50"
                                        onClick={() =>
                                          setEditingSceneId(editing ? null : scene.id)
                                        }
                                      >
                                        <Edit2 className="h-3 w-3 mr-1" />
                                        {editing ? "완료" : "편집"}
                                      </Button>
                                    </div>

                                    <div>
                                      <p className="text-[11px] font-semibold text-amber-200/90 mb-1">
                                        나레이션
                                      </p>
                                      {editing ? (
                                        <Textarea
                                          value={scene.narration}
                                          onChange={(e) =>
                                            handleUpdateStoryboardScene(scene.id, {
                                              narration: e.target.value,
                                            })
                                          }
                                          rows={2}
                                          className="text-sm resize-none bg-black/40 border-white/15"
                                        />
                                      ) : (
                                        <p className="text-sm text-zinc-100 leading-relaxed">
                                          {scene.narration}
                                        </p>
                                      )}
                                    </div>

                                    <div>
                                      <div className="flex items-center justify-between mb-1.5">
                                        <p className="text-[11px] font-semibold text-amber-200/90">
                                          대본
                                        </p>
                                      </div>
                                      <div className="rounded-lg border border-white/10 bg-black/35 p-3 space-y-2.5">
                                        <div>
                                          <span className="inline-block rounded bg-amber-500/20 border border-amber-400/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-200 mb-1.5">
                                            이미지 장면
                                          </span>
                                          {editing ? (
                                            <Textarea
                                              value={scene.imagePrompt || ""}
                                              onChange={(e) =>
                                                handleUpdateStoryboardScene(scene.id, {
                                                  imagePrompt: e.target.value,
                                                })
                                              }
                                              rows={3}
                                              className="text-[12px] resize-none bg-black/40 border-white/15"
                                            />
                                          ) : (
                                            <p className="text-[12.5px] text-zinc-300 leading-relaxed">
                                              {scene.imagePrompt || "—"}
                                            </p>
                                          )}
                                        </div>
                                        <div>
                                          <span className="inline-block rounded bg-sky-500/20 border border-sky-400/30 px-1.5 py-0.5 text-[10px] font-bold text-sky-200 mb-1.5">
                                            영상 프롬프트
                                          </span>
                                          {editing ? (
                                            <Textarea
                                              value={scene.motionPrompt || ""}
                                              onChange={(e) =>
                                                handleUpdateStoryboardScene(scene.id, {
                                                  motionPrompt: e.target.value,
                                                })
                                              }
                                              rows={2}
                                              className="text-[12px] resize-none bg-black/40 border-white/15 font-mono"
                                            />
                                          ) : (
                                            <p className="text-[12.5px] text-zinc-300 leading-relaxed font-mono">
                                              {scene.motionPrompt || "—"}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <Button
                    variant="outline"
                    onClick={() => setActiveStep("collect")}
                    className="flex-1 border-white/20 bg-[#fcffff] text-zinc-100 hover:bg-white/10 hover:text-white hover:border-orange-400/50 font-semibold shadow-md transition-all"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    이전
                  </Button>
                  <Button
                    onClick={() => setActiveStep("voice")}
                    disabled={!script.trim()}
                    className="flex-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 hover:from-orange-400 hover:via-amber-400 hover:to-orange-400 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/50 hover:shadow-xl hover:shadow-orange-500/50 transition-all duration-300"
                    size="lg"
                  >
                    다음: AI 음성
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      }

      case "voice":
        return (
          <AiVoiceStepPanel
            storyboardScenes={storyboardScenes}
            script={script}
            editedScript={editedScript}
            selectedVoiceId={selectedVoiceId}
            setSelectedVoiceId={setSelectedVoiceId}
            customElevenLabsVoiceId={customElevenLabsVoiceId}
            setCustomElevenLabsVoiceId={setCustomElevenLabsVoiceId}
            typecastVoices={typecastVoices}
            isLoadingTypecastVoices={isLoadingTypecastVoices}
            fetchTypecastVoices={fetchTypecastVoices}
            selectedTypecastVoiceId={selectedTypecastVoiceId}
            setSelectedTypecastVoiceId={setSelectedTypecastVoiceId}
            selectedTypecastEmotion={selectedTypecastEmotion}
            setSelectedTypecastEmotion={setSelectedTypecastEmotion}
            previewingVoiceId={previewingVoiceId}
            handlePreviewVoice={handlePreviewVoice}
            ttsAudioUrl={ttsAudioUrl}
            setTtsAudioUrl={setTtsAudioUrl}
            isGeneratingTTS={isGeneratingTTS}
            ttsProgress={ttsProgress}
            ttsSpeed={ttsSpeed}
            setTtsSpeed={setTtsSpeed}
            handleGenerateTTS={handleGenerateTTS}
            voiceRecordings={voiceRecordings}
            setVoiceRecordings={setVoiceRecordings}
            showRecordingDialog={showRecordingDialog}
            setShowRecordingDialog={setShowRecordingDialog}
            isRecordingVoice={isRecordingVoice}
            recordedVoiceUrl={recordedVoiceUrl}
            setRecordedVoiceUrl={setRecordedVoiceUrl}
            handleStartRecording={handleStartRecording}
            handleStopRecording={handleStopRecording}
            handleSaveRecordedVoice={handleSaveRecordedVoice}
            onBack={() => setActiveStep("scriptJson")}
            onNext={handleGoToImageGeneration}
          />
        )

      case "images":
        return (
          <AiShoppingImagesStep
            scenes={storyboardScenes}
            imageUrls={imageUrls}
            imagePrompts={imagePrompts}
            customImagePrompts={customImagePrompts}
            setCustomImagePrompt={(index, value) => {
              setCustomImagePrompts((prev) => {
                const next = new Map(prev)
                next.set(index, value)
                return next
              })
            }}
            selectedSceneIndex={selectedImageSceneIndex}
            setSelectedSceneIndex={setSelectedImageSceneIndex}
            selectedSlots={selectedImageSlots}
            setSelectedSlots={setSelectedImageSlots}
            imageModel={imageModel}
            setImageModel={setImageModel}
            scenePixabay={scenePixabay}
            isGeneratingAll={isGeneratingVideo}
            bulkGeneratingIndex={bulkImageGenerationIndex}
            isGeneratingPrompts={isGeneratingPrompts}
            regeneratingMap={isRegeneratingImage}
            error={error}
            productImage={productImage}
            productImages={productImages}
            onBack={() => setActiveStep("voice")}
            onNext={() => {
              const firstSelected = Array.from(selectedImageSlots).sort((a, b) => a - b)[0] ?? 0
              setSelectedVideoSceneIndex(firstSelected)
              setActiveStep("videos")
            }}
            onGenerateAll={async () => {
              let prompts = imagePrompts
              if (!promptsGenerated || prompts.length === 0) {
                const generated = await handleGenerateImagePrompts()
                if (!generated?.length) return
                prompts = generated
              }
              setIsGeneratingVideo(true)
              try {
                await generateSceneImagesInOrder(
                  storyboardScenes.map((_, index) => index),
                  prompts
                )
              } finally {
                setBulkImageGenerationIndex(null)
                setIsGeneratingVideo(false)
              }
            }}
            onGenerateMissing={() => void handleGenerateMissingImages()}
            onRegenerateOne={async (index) => {
              let prompts = imagePrompts
              if (!promptsGenerated || prompts.length === 0) {
                const generated = await handleGenerateImagePrompts()
                if (!generated?.length) return
                prompts = generated
              }
              await handleRegenerateSingleImage(index, prompts)
            }}
            onUploadFile={handleSceneImageUpload}
            onClearSlot={clearSceneImageAt}
            onRestoreAiImage={restoreSceneAiImage}
            onClearAll={clearAllSceneImages}
            onSavePrompt={saveImagePromptAt}
            onGetKeywordSuggestions={getPixabaySuggestionsForScene}
            onSearchPixabay={(index, keyword) => searchPixabayForScene(index, keyword)}
            onSelectPixabay={(index, hit) => {
              const url = hit.largeImageURL || hit.webformatURL || hit.previewURL
              setSceneImageAt(index, url)
              setFreeImageUrls((prev) => (prev.includes(url) ? prev : [...prev, url]))
              const sceneId = storyboardScenes[index]?.id
              if (sceneId) {
                setStoryboardScenes((prev) =>
                  prev.map((scene) =>
                    scene.id === sceneId ? { ...scene, freeImageUrl: url, imageUrl: url } : scene
                  )
                )
              }
            }}
          />
        )

      case "thumbnail":
        return (
          <AiShoppingThumbnailStep
            productName={productName || "상품"}
            productImage={productImage}
            imageUrls={
              // AI이미지 단계 결과 우선 · 스토리보드에만 남은 URL도 반영
              imageUrls.some(Boolean)
                ? imageUrls
                : storyboardScenes.map((scene) => scene.imageUrl || "")
            }
            hookingText={thumbnailHookingText}
            onHookingTextChange={setThumbnailHookingText}
            isGeneratingThumbnail={isGeneratingThumbnail}
            onGenerateThumbnail={() => void handleGenerateThumbnail()}
            thumbnailUrl={thumbnailUrl}
            thumbnailCanvasRef={thumbnailCanvasRef}
            onDownloadThumbnail={handleDownloadThumbnail}
            customThumbnailImage={customThumbnailImage || null}
            studioDesign={thumbnailStudioDesign}
            onStudioApply={(dataUrl, nextHookingText, design) => {
              const nextItem = {
                url: dataUrl,
                text: nextHookingText,
                // 스튜디오 출력은 텍스트가 합성된 완성 PNG입니다.
                isCustom: false,
              }
              setThumbnailStudioDesign(design)
              setThumbnailHookingText(nextHookingText)
              setThumbnailUrl(dataUrl)
              setThumbnailImages((previous) => {
                const next = [...previous, nextItem]
                setSelectedThumbnailIndex(next.length - 1)
                return next
              })
            }}
            error={error || undefined}
            onBack={() => setActiveStep("videos")}
            onNext={() => setActiveStep("preview")}
          />
        )

      case "preview":
        return (
          // 리믹스 쇼핑숏폼 편집기처럼 전체 폭을 쓰도록 Ver2StepShell 없이 그린다.
          <div className="mx-auto max-w-[1280px] space-y-6">
            <AiShoppingEditWorkspace
              projectTitle={productName.trim() || "AI 쇼핑 숏폼"}
              selectedThumbnail={
                selectedThumbnailIndex >= 0 && thumbnailImages[selectedThumbnailIndex]
                  ? { url: thumbnailImages[selectedThumbnailIndex].url, index: selectedThumbnailIndex }
                  : null
              }
              onGoThumbnail={() => setActiveStep("thumbnail")}
              captionCues={scriptLines.map((line) => ({
                text: line.text,
                start: line.startTime / 1000,
                end: line.endTime / 1000,
              }))}
              onProRender={() => void handleProRender()}
              proRenderStatus={proRenderStatus}
              proRenderDisabled={isRendering}
              previewVideoHostRef={previewVideoHostRef}
              previewGenerated={previewGenerated}
              hasVideos={(() => {
                const indices =
                  sceneTtsTracks.length > 0
                    ? sceneTtsTracks.map((track) => track.sceneIndex)
                    : getPipelineSceneIndices()
                const videos = collectExistingSceneVideos()
                return indices.length > 0 && indices.every((index) => videos.has(index))
              })()}
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
              }}
              videoZoom={editVideoZoom}
              videoOffsetX={editVideoOffsetX}
              videoOffsetY={editVideoOffsetY}
              onVideoZoomChange={setEditVideoZoom}
              onVideoOffsetXChange={setEditVideoOffsetX}
              onVideoOffsetYChange={setEditVideoOffsetY}
              onResetTransform={() => {
                setEditVideoZoom(100)
                setEditVideoOffsetX(0)
                setEditVideoOffsetY(0)
              }}
              originalClipSound={originalClipSound}
              onOriginalClipSoundChange={(v) => {
                setOriginalClipSound(v)
                if (previewVideoRef.current) previewVideoRef.current.muted = !v
              }}
              bgmTrackId={
                VOICE_PREVIEW_BGM_OPTIONS.find((o) => o.src === bgmUrl)?.id ?? (bgmUrl ? "custom" : "")
              }
              onBgmTrackChange={(id) => {
                if (id === "custom") return
                const src = voicePreviewBgmSrc(id)
                if (!src) {
                  handleDeleteBgm()
                  return
                }
                setBgmFile(null)
                setBgmUrl(src)
                setBgmStartTime(0)
                setBgmEndTime(BGM_FULL_LENGTH_SEC)
              }}
              bgmVolume={bgmVolume}
              onBgmVolumeChange={setBgmVolume}
              previewThumbnailSrc={previewThumbnailImage?.src || null}
              videoTransitionOpacity={videoTransitionOpacity}
              scriptLineCount={scriptLines.length}
              sceneCount={Math.max(1, sceneTtsTracks.length || convertedVideoUrls.size)}
              sceneDurations={sceneTtsTracks.map((track) => track.durationMs / 1000)}
              workspaceTab={editWorkspaceTab}
              onWorkspaceTabChange={setEditWorkspaceTab}
              settingsTab={editSettingsTab}
              onSettingsTabChange={setEditSettingsTab}
              isGeneratingPreview={isGeneratingPreview}
              onGeneratePreview={() => void handleGeneratePreview()}
              exportActions={
                <div className="space-y-2">
                  {videoUrl ? (
                    <Button onClick={handleDownload} className="w-full h-11 bg-emerald-500 hover:bg-green-600 text-white font-semibold" size="lg">
                      <Download className="w-4 h-4 mr-2" />
                      영상 다운로드
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleRenderVideo()}
                      disabled={isRendering || !previewGenerated}
                      variant="outline"
                      className="w-full h-9 font-medium disabled:opacity-50"
                      size="sm"
                    >
                      {isRendering ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          렌더링 중...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          기존 방식으로 다운로드
                        </>
                      )}
                    </Button>
                  )}
                  <SeparateAssetDownloads
                    busyId={separateAssetBusy}
                    onDownload={(id) => void handleSeparateAssetDownload(id)}
                    items={[
                      {
                        id: "srt",
                        label: "자막만 (SRT)",
                        hint: "타이밍 자막 파일",
                        disabled: scriptLines.length === 0,
                        missingReason: "자막 타이밍 없음",
                      },
                      {
                        id: "thumbnail",
                        label: "썸네일만",
                        hint: "선택한 썸네일 PNG",
                        disabled:
                          selectedThumbnailIndex < 0 &&
                          !thumbnailUrl &&
                          !thumbnailCanvasRef.current,
                        missingReason: "썸네일 없음",
                      },
                      {
                        id: "video",
                        label: "영상만",
                        hint: "장면 클립(ZIP/MP4)",
                        disabled: convertedVideoUrls.size === 0,
                        missingReason: "장면 영상 없음",
                      },
                      {
                        id: "tts",
                        label: "TTS만",
                        hint: "나레이션 오디오",
                        disabled: !ttsAudioUrl,
                        missingReason: "TTS 없음",
                      },
                    ]}
                  />
                </div>
              }
            />

            {/* 이전/처음으로 버튼 */}
            <div className="flex shrink-0 gap-3 border-t border-white/10 pt-4">
              <Button
                variant="outline"
                onClick={() => setActiveStep("thumbnail")}
                className="flex-1 !border-orange-400/60 !bg-[#fffcf3] !text-orange-100 font-semibold shadow-md transition-all hover:!border-orange-300 hover:!bg-[#ffeee2] hover:!text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                이전 · 썸네일
              </Button>
              <Button
                onClick={() => setActiveStep("metadata")}
                className="flex-1 border border-orange-300 bg-gradient-to-r from-orange-500 to-amber-500 text-zinc-950 font-bold shadow-[0_0_18px_rgba(249,115,22,0.2)] transition-all hover:from-orange-400 hover:to-amber-400 hover:text-black"
              >
                다음 · 유튜브 정보
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )

      case "metadata":
        return (
          <Ver2StepShell
            stepLabel="9단계"
            title="유튜브 정보"
            description="완성된 쇼츠에 사용할 제목 · 설명 · 태그를 생성하고 수정합니다."
            icon={FileText}
            accent="amber"
          >
            <Card className="border border-white/10 bg-[#fdfeff]">
              <CardHeader className="border-b border-white/10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base text-zinc-100">유튜브 제목 · 설명 · 태그</CardTitle>
                    <p className="mt-1 text-xs text-zinc-500">
                      제품 정보와 대본을 기반으로 쇼츠 업로드 정보를 생성합니다.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => void handleGenerateMetadata()}
                    disabled={isGeneratingMetadata || !script.trim()}
                    className="bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
                  >
                    {isGeneratingMetadata ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    {youtubeTitle ? "다시 생성" : "AI로 생성"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 py-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="youtube-title" className="text-sm text-zinc-300">
                      제목
                    </Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!youtubeTitle.trim()}
                      onClick={() => void copyYoutubeField("title", youtubeTitle)}
                      className="h-7 border-white/15 bg-black/30 px-2.5 text-[11px] text-zinc-200 hover:bg-white/10 hover:text-white"
                    >
                      {copiedTitle ? (
                        <Check className="mr-1 h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="mr-1 h-3.5 w-3.5" />
                      )}
                      {copiedTitle ? "복사됨" : "복사"}
                    </Button>
                  </div>
                  <Input
                    id="youtube-title"
                    value={youtubeTitle}
                    onChange={(event) => setYoutubeTitle(event.target.value)}
                    placeholder="유튜브 쇼츠 제목"
                    className="border-white/15 bg-black/30 text-zinc-100 placeholder:text-zinc-600"
                  />
                  <p className="text-right text-[11px] text-zinc-600">{youtubeTitle.length}자</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="youtube-description" className="text-sm text-zinc-300">
                      설명
                    </Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!youtubeDescription.trim()}
                      onClick={() => void copyYoutubeField("description", youtubeDescription)}
                      className="h-7 border-white/15 bg-black/30 px-2.5 text-[11px] text-zinc-200 hover:bg-white/10 hover:text-white"
                    >
                      {copiedDescription ? (
                        <Check className="mr-1 h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="mr-1 h-3.5 w-3.5" />
                      )}
                      {copiedDescription ? "복사됨" : "복사"}
                    </Button>
                  </div>
                  <Textarea
                    id="youtube-description"
                    value={youtubeDescription}
                    onChange={(event) => setYoutubeDescription(event.target.value)}
                    placeholder="영상 설명과 제품 정보를 입력하세요."
                    className="min-h-40 resize-y border-white/15 bg-black/30 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="youtube-tags" className="text-sm text-zinc-300">
                      태그
                    </Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!youtubeTagsDraft.trim() && youtubeTags.length === 0}
                      onClick={() =>
                        void copyYoutubeField(
                          "tags",
                          youtubeTagsDraft.trim() || youtubeTags.join(", ")
                        )
                      }
                      className="h-7 border-white/15 bg-black/30 px-2.5 text-[11px] text-zinc-200 hover:bg-white/10 hover:text-white"
                    >
                      {copiedTags ? (
                        <Check className="mr-1 h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="mr-1 h-3.5 w-3.5" />
                      )}
                      {copiedTags ? "복사됨" : "복사"}
                    </Button>
                  </div>
                  <Input
                    id="youtube-tags"
                    value={youtubeTagsDraft}
                    onChange={(event) => {
                      const draft = event.target.value
                      setYoutubeTagsDraft(draft)
                      setYoutubeTags(
                        draft
                          .split(",")
                          .map((tag) => tag.trim().replace(/^#/, ""))
                          .filter(Boolean)
                      )
                    }}
                    placeholder="쇼츠, 제품명, 추천템"
                    className="border-white/15 bg-black/30 text-zinc-100 placeholder:text-zinc-600"
                  />
                  <p className="text-[11px] text-zinc-600">태그는 쉼표로 구분합니다.</p>
                </div>

                {youtubeTags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {youtubeTags.map((tag, index) => (
                      <span
                        key={`${tag}-${index}`}
                        className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="flex gap-3 border-t border-white/10 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveStep("preview")}
                className="flex-1 border-white/15 bg-[#fcffff] text-zinc-200 hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                이전 · AI영상편집
              </Button>
            </div>
          </Ver2StepShell>
        )

      case "videos": {
        const videoSceneIndices = storyboardScenes
          .map((_, index) => index)
          .filter((index) => Boolean(imageUrls[index]))
        const sceneIdx = videoSceneIndices.includes(selectedVideoSceneIndex)
          ? selectedVideoSceneIndex
          : videoSceneIndices[0] ?? 0
        const existingVideoMap = collectExistingSceneVideos()
        const currentVideoUrl =
          existingVideoMap.get(sceneIdx) || convertedVideoUrls.get(sceneIdx)
        const currentImageUrl = imageUrls[sceneIdx]
        const currentPrompt =
          videoPrompts.get(sceneIdx) || storyboardScenes[sceneIdx]?.motionPrompt || ""
        const sceneDialogue =
          storyboardScenes[sceneIdx]?.narration ||
          scenes[sceneIdx] ||
          imagePrompts[sceneIdx]?.scriptText ||
          scriptLines.find((l) => l.text)?.text ||
          ""
        const isBusyScene =
          !!isConvertingToVideo.get(sceneIdx) || !!isGeneratingVideoPrompts.get(sceneIdx)
        const isBusyAny =
          isPreparingImageZoomClips ||
          Array.from(isConvertingToVideo.values()).some(Boolean) ||
          Array.from(isGeneratingVideoPrompts.values()).some(Boolean)
        const missingSlots = videoSceneIndices.filter(
          (i) => !existingVideoMap.has(i) && !!imageUrls[i]
        )
        const missingCount = missingSlots.length
        const completedCount = videoSceneIndices.filter((i) => existingVideoMap.has(i)).length
        const canProceedWithoutSeedance =
          useImageZoomInsteadOfAiVideo &&
          imageZoomClipsPrepared &&
          videoSceneIndices.length > 0 &&
          videoSceneIndices.every((i) => existingVideoMap.has(i))
        const canGoNextFromVideos = useImageZoomInsteadOfAiVideo
          ? imageUrls.filter(Boolean).length > 0
          : convertedVideoUrls.size >= 1
        const videoTtsPreviewItems: Array<{
          sceneIndex: number
          title: string
          videoUrl: string
          durationMs: number
        }> = []
        sceneTtsTracks.forEach((track) => {
          const videoUrl = existingVideoMap.get(track.sceneIndex)
          if (!videoUrl) return
          videoTtsPreviewItems.push({
            sceneIndex: track.sceneIndex,
            title: storyboardScenes[track.sceneIndex]?.title || `장면 ${track.sceneIndex + 1}`,
            videoUrl,
            durationMs: track.durationMs,
          })
        })
        const canPreviewVideoWithTts =
          Boolean(ttsAudioUrl) &&
          sceneTtsTracks.length > 0 &&
          videoTtsPreviewItems.length === sceneTtsTracks.length

        return (
          <Ver2StepShell
            stepLabel="6단계"
            title="AI영상"
            description="Seedance 생성 또는 영상 없이 이미지 줌인으로 진행 · Pixabay 무료 동영상"
            icon={Film}
            accent="amber"
            headerRight={
              <>
                <Button
                  variant="outline"
                  onClick={() => setActiveStep("images")}
                  className={P.headerBack}
                >
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  이전
                </Button>
                <Button
                  disabled={!canGoNextFromVideos || isBusyAny}
                  onClick={() => {
                    void (async () => {
                      if (useImageZoomInsteadOfAiVideo && !canProceedWithoutSeedance) {
                        const ok = await handlePrepareImageZoomClips({ silent: true })
                        if (!ok) return
                      }
                      setActiveStep("thumbnail")
                    })()
                  }}
                  className={P.headerNext}
                >
                  다음 · 썸네일
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </>
            }
          >
            <div className="light-keep space-y-4 text-[#0e1016]">
            {/* 장면 탭 */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {videoSceneIndices.map((i) => {
                const hasVideo = existingVideoMap.has(i)
                const active = sceneIdx === i
                const busy = !!isConvertingToVideo.get(i) || !!isGeneratingVideoPrompts.get(i)
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedVideoSceneIndex(i)}
                    aria-pressed={active}
                    className={`flex shrink-0 items-center gap-2.5 px-3 py-2 ${P.chip(active)}`}
                  >
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[12px] font-bold ${
                        active ? "bg-[#2f3beb] text-[#ffffff]" : "bg-[#f0f1f5] text-[#0e1016]"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block max-w-[140px] truncate text-[13px] font-semibold text-[#0e1016]">
                        {storyboardScenes[i]?.title || `장면 ${i + 1}`}
                      </span>
                      <StatusDot tone={busy ? "busy" : hasVideo ? "done" : imageUrls[i] ? "wait" : "none"}>
                        {busy
                          ? "생성 중"
                          : hasVideo
                            ? useImageZoomInsteadOfAiVideo && imageZoomClipsPrepared
                              ? "줌인 클립"
                              : "영상 있음"
                            : imageUrls[i]
                              ? useImageZoomInsteadOfAiVideo
                                ? "줌인 대기"
                                : "미생성"
                              : "이미지 없음"}
                      </StatusDot>
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
              {/* 미리보기 */}
              <section className={`${P.card} space-y-4 p-5 xl:col-span-5`}>
                <p className={`${P.title} truncate`}>
                  <span className="text-[#2f3beb]">M{sceneIdx + 1}</span>{" "}
                  <span className="font-medium text-[#5c6170]">
                    {(sceneDialogue || storyboardScenes[sceneIdx]?.title || `장면 ${sceneIdx + 1}`).slice(0, 28)}
                    {(sceneDialogue || "").length > 28 ? "…" : ""}
                  </span>
                </p>

                <div className="rounded-[20px] bg-[#eef0f5] px-3 py-6">
                  <PhoneFrame>
                    {isBusyScene ? (
                      <>
                        {currentImageUrl ? (
                          <img src={currentImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
                        ) : null}
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0e1016]/60">
                          <Loader2 className="h-9 w-9 text-[#ffffff] motion-safe:animate-spin" />
                          <p className="text-[12px] text-[#e3e6ec]">
                            {isGeneratingVideoPrompts.get(sceneIdx)
                              ? "프롬프트 생성 중…"
                              : useImageZoomInsteadOfAiVideo
                                ? "줌인 효과 적용 중…"
                                : "Seedance 영상 생성 중…"}
                          </p>
                        </div>
                      </>
                    ) : currentVideoUrl ? (
                      <video
                        key={currentVideoUrl}
                        src={currentVideoUrl}
                        controls
                        className="absolute inset-0 h-full w-full object-cover"
                        playsInline
                      />
                    ) : currentImageUrl ? (
                      <>
                        <img src={currentImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
                        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#000000]/60 px-2.5 py-1 text-[12px] text-[#e3e6ec]">
                          영상 없음 · 이미지 미리보기
                        </span>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-[#9aa0ad]">
                        <Film className="h-9 w-9 opacity-60" />
                        <p className="text-[12px]">미리보기 영상이 없습니다</p>
                      </div>
                    )}
                  </PhoneFrame>
                  <input
                    ref={(el) => {
                      sceneVideoUploadRefs.current[sceneIdx] = el
                    }}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      handleSceneVideoUpload(sceneIdx, e.target.files?.[0] ?? null)
                      e.target.value = ""
                    }}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    className={`h-9 px-3 text-[13px] ${P.ghost}`}
                    onClick={() => sceneVideoUploadRefs.current[sceneIdx]?.click()}
                  >
                    <Upload className="mr-1.5 h-4 w-4" />
                    비디오 추가
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className={`h-9 px-3 text-[13px] ${P.ghost}`}
                    onClick={() => openPixabayVideoPicker(sceneIdx)}
                  >
                    <Search className="mr-1.5 h-4 w-4" />
                    무료 동영상 가져오기
                  </Button>
                  {currentVideoUrl ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className={`h-9 px-3 text-[13px] ${P.danger}`}
                      onClick={() => handleDeleteSceneVideo(sceneIdx)}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      삭제
                    </Button>
                  ) : null}
                </div>

                <div className={`${P.soft} p-4`}>
                  <p className={`${P.label} mb-1`}>이 구간 대사</p>
                  <p className="min-h-[2.5rem] whitespace-pre-wrap text-[14px] leading-relaxed text-[#0e1016]">
                    {sceneDialogue || "(대본 없음)"}
                  </p>
                </div>
              </section>

              <div className="space-y-4 xl:col-span-7">
                {/* 진행 방식 */}
                <section className={`${P.card} space-y-4 p-5`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={P.title}>진행 방식</p>
                    <span className="text-[12px] text-[#5c6170]" aria-live="polite">
                      영상 {completedCount}/{videoSceneIndices.length} 완료
                      {!useImageZoomInsteadOfAiVideo && missingCount > 0 ? ` · 미생성 ${missingCount}` : ""}
                    </span>
                  </div>
                  <label
                    htmlFor="image-zoom-only"
                    className={`flex cursor-pointer items-start gap-3 rounded-[14px] border p-3.5 motion-safe:transition ${
                      useImageZoomInsteadOfAiVideo
                        ? "border-[#2f3beb] bg-[#f4f5ff]"
                        : "border-[#e3e6ec] bg-[#ffffff] hover:bg-[#fafbfc]"
                    }`}
                  >
                    <Checkbox
                      id="image-zoom-only"
                      checked={useImageZoomInsteadOfAiVideo}
                      onCheckedChange={(checked) => {
                        const on = checked === true
                        setUseImageZoomInsteadOfAiVideo(on)
                        if (!on) setImageZoomClipsPrepared(false)
                      }}
                      className="mt-0.5 border-[#c9cdd6] data-[state=checked]:border-[#2f3beb] data-[state=checked]:bg-[#2f3beb] data-[state=checked]:text-[#ffffff]"
                    />
                    <span className="min-w-0">
                      <span className="block text-[14px] font-semibold text-[#0e1016]">
                        영상 없이 줌인 효과로 진행
                      </span>
                      <span className={`mt-0.5 block ${P.muted}`}>
                        Seedance AI 영상을 만들지 않고, AI이미지에 Ken Burns 줌인을 적용해
                        미리보기·다운로드합니다. (줌인 필수)
                      </span>
                    </span>
                  </label>

                  {useImageZoomInsteadOfAiVideo ? (
                    <div className="space-y-2">
                      <Button
                        type="button"
                        className={`h-11 w-full ${P.primary}`}
                        disabled={isBusyAny || imageUrls.filter(Boolean).length === 0}
                        onClick={() => void handlePrepareImageZoomClips()}
                      >
                        {isPreparingImageZoomClips ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
                            줌인 클립 준비 중…
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            {completedCount > 0 && canProceedWithoutSeedance
                              ? "줌인 클립 다시 만들기"
                              : "이미지 줌인 클립 만들기"}
                          </>
                        )}
                      </Button>
                      {canProceedWithoutSeedance ? (
                        <StatusDot tone="done">준비 완료 · 다음(썸네일) 또는 AI영상편집에서 렌더하세요.</StatusDot>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Button
                        type="button"
                        className={`h-11 w-full ${P.primary}`}
                        disabled={isBusyAny || missingCount === 0}
                        onClick={() => void handleConvertAllImagesToVideos({ onlyMissing: true })}
                      >
                        {isBusyAny ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
                            생성 중 ({completedCount}/{videoSceneIndices.length})
                          </>
                        ) : missingCount > 0 ? (
                          <>
                            <Video className="mr-2 h-4 w-4" />
                            미생성 장면 일괄 생성 ({missingCount})
                          </>
                        ) : (
                          "모든 장면 영상 완료"
                        )}
                      </Button>
                      <p className={P.faint}>
                        이미지가 있는 미생성 장면만 · {SHOPPING_VIDEO_MODEL_META[videoGenerationModel].label}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        className={`h-9 w-full text-[13px] ${P.danger}`}
                        disabled={isBusyAny || imageUrls.filter(Boolean).length === 0}
                        onClick={() => {
                          if (
                            completedCount > 0 &&
                            !confirm(
                              `이미 생성된 영상 ${completedCount}개를 모두 지우고 처음부터 다시 만들까요?`
                            )
                          ) {
                            return
                          }
                          void handleConvertAllImagesToVideos({ onlyMissing: false, forceAll: true })
                        }}
                      >
                        전체 재생성 (기존 영상 삭제)
                      </Button>
                    </div>
                  )}
                </section>

                {/* 이 장면 */}
                <section className={`${P.card} space-y-4 p-5`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={P.title}>
                      이 장면 <span className="text-[#2f3beb]">M{sceneIdx + 1}</span>
                    </p>
                    <span className={`${P.faint} max-w-[60%] truncate`}>
                      {storyboardScenes[sceneIdx]?.title || `장면 ${sceneIdx + 1}`}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <Label className={P.label}>영상 모델</Label>
                    <Select
                      value={videoGenerationModel}
                      onValueChange={(value) =>
                        setVideoGenerationModel(value as ShoppingVideoGenerationModel)
                      }
                      disabled={isBusyAny || useImageZoomInsteadOfAiVideo}
                    >
                      <SelectTrigger className={P.select}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="seedance-1-pro-fast">
                          Seedance 1 Pro Fast (Replicate · ver1)
                        </SelectItem>
                        <SelectItem value="seedance-1.5-pro">
                          Seedance 1.5 Pro (무음 · 720p)
                        </SelectItem>
                        <SelectItem value="p-video-draft">
                          P-Video 720p Draft ($0.005/초)
                        </SelectItem>
                        <SelectItem value="veo" disabled={!veoReady}>
                          Google Veo · Flow 모델{veoReady ? "" : " (키 권한 필요)"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className={P.faint}>
                      {useImageZoomInsteadOfAiVideo
                        ? "줌인 모드: Seedance 모델을 사용하지 않습니다."
                        : SHOPPING_VIDEO_MODEL_META[videoGenerationModel].description}
                    </p>
                  </div>

                  {/* Google Flow 에서 직접 만들기: 프롬프트·장면 이미지를 Flow 에 넣고, 받은 영상을 이 장면에 올린다 (자동 조작 없음) */}
                  <details className="group rounded-2xl border border-[#e3e6ec] bg-[#fafbfc] p-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[13px] font-bold text-[#0e1016]">
                      Google Flow에서 직접 만들기
                      <span className="text-[11px] font-semibold text-[#9aa0ad] group-open:hidden">펼치기</span>
                    </summary>
                    <ol className="mt-3 space-y-2.5 text-[12px] text-[#5c6170]">
                      <li className="flex items-center gap-2">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#eef0fb] text-[10px] font-bold text-[#2f3beb]">1</span>
                        <span className="flex-1">장면 이미지와 프롬프트를 챙겨요</span>
                        <button type="button" disabled={!imageUrls[sceneIdx]}
                          onClick={() => { const a = document.createElement("a"); a.href = imageUrls[sceneIdx]!; a.download = `scene_${sceneIdx + 1}.png`; a.target = "_blank"; a.click() }}
                          className="rounded-lg border border-[#e3e6ec] bg-[#ffffff] px-2.5 py-1 font-semibold text-[#0e1016] hover:border-[#2f3beb] disabled:opacity-40">이미지</button>
                        <button type="button"
                          onClick={() => {
                            const text = videoPrompts.get(sceneIdx) || storyboardScenes[sceneIdx]?.motionPrompt || ""
                            void navigator.clipboard.writeText(text).then(() => { setFlowCopied(true); setTimeout(() => setFlowCopied(false), 1500) })
                          }}
                          className="rounded-lg border border-[#e3e6ec] bg-[#ffffff] px-2.5 py-1 font-semibold text-[#0e1016] hover:border-[#2f3beb]">{flowCopied ? "복사됨" : "프롬프트"}</button>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#eef0fb] text-[10px] font-bold text-[#2f3beb]">2</span>
                        <span className="flex-1">Flow에서 이미지로 영상 만들기 (9:16)</span>
                        <a href="https://labs.google/fx/tools/flow" target="_blank" rel="noreferrer"
                          className="rounded-lg bg-[#0e1016] px-2.5 py-1 font-semibold text-[#ffffff] hover:bg-[#23262f]">Flow 열기</a>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#eef0fb] text-[10px] font-bold text-[#2f3beb]">3</span>
                        <span className="flex-1">받은 영상을 이 장면에 올리기</span>
                        <label className="cursor-pointer rounded-lg bg-[#2f3beb] px-2.5 py-1 font-semibold text-[#ffffff] hover:bg-[#4350ff]">
                          영상 올리기
                          <input type="file" accept="video/*" className="sr-only"
                            onChange={(e) => { handleSceneVideoUpload(sceneIdx, e.target.files?.[0] ?? null); e.currentTarget.value = "" }} />
                        </label>
                      </li>
                    </ol>
                    <FlowExtensionBridge
                      sceneIndex={sceneIdx}
                      imageUrl={imageUrls[sceneIdx] || undefined}
                      prompt={videoPrompts.get(sceneIdx) || storyboardScenes[sceneIdx]?.motionPrompt || ""}
                      onVideo={handleSceneVideoUpload}
                    />
                  </details>

                  <Button
                    type="button"
                    variant="outline"
                    className={`h-11 w-full ${P.outline}`}
                    disabled={useImageZoomInsteadOfAiVideo || isBusyAny || !imageUrls[sceneIdx]}
                    onClick={() => void handleRegenerateSingleVideo(sceneIdx)}
                  >
                    {isBusyScene ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
                        생성 중…
                      </>
                    ) : (
                      <>
                        <Video className="mr-2 h-4 w-4" />
                        이 장면 영상 생성
                      </>
                    )}
                  </Button>
                  {useImageZoomInsteadOfAiVideo ? (
                    <p className={P.faint}>줌인 모드에서는 Seedance 생성이 꺼집니다.</p>
                  ) : null}

                  <details className="group rounded-[16px] border border-[#eceef3] bg-[#fafbfc] px-4 py-3">
                    <summary className={P.summary}>
                      <span className="inline-flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[#5c6170]" />
                        생성 프롬프트
                      </span>
                      <ChevronDown className="h-4 w-4 text-[#9aa0ad] motion-safe:transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="mt-3 space-y-2">
                      <BilingualPromptPanel
                        prompt={currentPrompt || sceneDialogue || ""}
                        title="한·영 프롬프트"
                        emptyText="프롬프트가 아직 없습니다. 영상 생성 시 자동으로 만들어집니다."
                        referenceImageUrl={
                          productImages[0] || productImage || undefined
                        }
                        referenceDownloadName={
                          (productName || "product").slice(0, 40) + "-original"
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className={`h-9 w-full text-[13px] ${P.outline}`}
                        onClick={() => {
                          setEditingVideoPrompt(currentPrompt || sceneDialogue || "")
                          setShowVideoPromptEditor(true)
                        }}
                      >
                        프롬프트 직접 수정
                      </Button>
                    </div>
                  </details>
                </section>

                {/* 결과 확인 · 다운로드 */}
                <section className={`${P.card} space-y-3 p-5`}>
                  <div className="flex items-center justify-between">
                    <p className={P.title}>생성된 영상</p>
                    <span className={P.faint}>
                      {existingVideoMap.size}개 · {selectedVideoSlots.size}개 선택
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {videoSceneIndices.map((i) => {
                      const url = existingVideoMap.get(i)
                      if (!url) return null
                      const checked = selectedVideoSlots.has(i)
                      return (
                        <button
                          key={i}
                          type="button"
                          aria-pressed={checked}
                          aria-label={`장면 ${i + 1} 영상 선택`}
                          onClick={() => {
                            setSelectedVideoSceneIndex(i)
                            setSelectedVideoSlots((prev) => {
                              const next = new Set(prev)
                              if (next.has(i)) next.delete(i)
                              else next.add(i)
                              return next
                            })
                          }}
                          className={`relative aspect-[9/16] w-14 overflow-hidden rounded-[10px] border-2 ${P.focus} ${
                            checked ? "border-[#2f3beb]" : "border-transparent"
                          }`}
                        >
                          <video src={url} muted className="h-full w-full object-cover" />
                          <span className="absolute inset-x-0 bottom-0 bg-[#000000]/70 text-center text-[12px] text-[#ffffff]">
                            {i + 1}
                          </span>
                        </button>
                      )
                    })}
                    {existingVideoMap.size === 0 ? (
                      <p className={P.faint}>아직 생성된 영상이 없습니다</p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <Button
                      type="button"
                      variant="outline"
                      className={`h-10 ${P.outline}`}
                      onClick={() => void handleDownloadSelectedVideos()}
                      disabled={selectedVideoSlots.size === 0}
                    >
                      <Download className="mr-1.5 h-4 w-4" />
                      선택 다운로드 ({selectedVideoSlots.size})
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className={`h-10 ${P.ghost}`}
                      onClick={() => setSelectedVideoSlots(new Set())}
                    >
                      <X className="mr-1.5 h-4 w-4" />
                      선택 해제
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!canPreviewVideoWithTts || isBusyAny}
                      onClick={() => setVideoTtsPreviewOpen(true)}
                      className={`col-span-2 h-10 sm:col-span-1 ${P.outline}`}
                    >
                      <Play className="mr-1.5 h-4 w-4" />
                      영상 + TTS 미리듣기
                    </Button>
                  </div>
                  {!canPreviewVideoWithTts ? (
                    <p className={P.faint}>미리듣기에는 모든 장면의 영상과 장면별 AI 음성이 필요합니다.</p>
                  ) : null}
                </section>

                {error ? (
                  <p
                    role="alert"
                    className="whitespace-pre-wrap rounded-[12px] border border-[#f6d0d0] bg-[#fff4f4] px-3 py-2 text-[13px] text-[#c62828]"
                  >
                    {error}
                  </p>
                ) : null}
              </div>
            </div>
            </div>

            <SceneVideoTtsPreviewDialog
              open={videoTtsPreviewOpen}
              onOpenChange={setVideoTtsPreviewOpen}
              audioUrl={ttsAudioUrl}
              items={videoTtsPreviewItems}
            />

            {/* 프롬프트 편집 */}
            <Dialog open={showVideoPromptEditor} onOpenChange={setShowVideoPromptEditor}>
              <DialogContent className="max-w-lg bg-[#fdfeff] border-white/15 text-zinc-100">
                <DialogHeader>
                  <DialogTitle>영상 프롬프트 · M{sceneIdx + 1}</DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    Seedance 생성 시 이 프롬프트를 사용합니다. 비워 두면 생성 시 자동으로 만듭니다.
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  value={editingVideoPrompt}
                  onChange={(e) => setEditingVideoPrompt(e.target.value)}
                  className="min-h-[180px] bg-black/40 border-white/15 font-mono text-xs"
                />
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    className="border-white/15 bg-[#fcffff] text-zinc-200 hover:bg-white/10 hover:text-white"
                    onClick={() => setShowVideoPromptEditor(false)}
                  >
                    취소
                  </Button>
                  <Button
                    className={P.primary}
                    onClick={() => {
                      setVideoPrompts((prev) => {
                        const next = new Map(prev)
                        if (editingVideoPrompt.trim()) next.set(sceneIdx, editingVideoPrompt.trim())
                        else next.delete(sceneIdx)
                        return next
                      })
                      setShowVideoPromptEditor(false)
                    }}
                  >
                    저장
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Pixabay 동영상 */}
            <Dialog open={showPixabayVideoDialog} onOpenChange={setShowPixabayVideoDialog}>
              <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-[#fdfeff] border-white/15 text-zinc-100">
                <DialogHeader>
                  <DialogTitle>Pixabay 무료 동영상</DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    장면 M{(pixabayVideoTargetSlot ?? sceneIdx) + 1}에 적용할 동영상을 선택하세요.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex gap-2">
                  <Input
                    placeholder="검색어 (예: product unboxing, lifestyle)"
                    value={pixabayVideoQuery}
                    onChange={(e) => setPixabayVideoQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        void handleSearchPixabayVideos()
                      }
                    }}
                    className="flex-1 bg-black/40 border-white/15"
                  />
                  <Button
                    type="button"
                    onClick={() => void handleSearchPixabayVideos()}
                    disabled={isSearchingPixabayVideo}
                    className={P.accent}
                  >
                    {isSearchingPixabayVideo ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Search className="w-4 h-4 mr-2" />
                        검색
                      </>
                    )}
                  </Button>
                </div>
                {pixabayVideoError ? <p className="text-sm text-red-400">{pixabayVideoError}</p> : null}
                {pixabayVideoTotal > 0 ? (
                  <p className="text-xs text-zinc-500">약 {pixabayVideoTotal.toLocaleString()}건</p>
                ) : null}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {pixabayVideoHits.map((hit) => (
                    <button
                      key={hit.id}
                      type="button"
                      onClick={() => handleSelectPixabayVideo(hit)}
                      className="group relative aspect-[9/16] rounded-lg overflow-hidden border border-white/15 hover:border-teal-400/60 text-left"
                    >
                      {hit.previewURL ? (
                        <img src={hit.previewURL} alt={hit.tags} className="w-full h-full object-cover" />
                      ) : (
                        <video src={hit.videoURL} muted className="w-full h-full object-cover" />
                      )}
                      <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition">
                        <Play className="w-8 h-8 text-white" />
                      </span>
                      <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[10px] text-white px-1 py-0.5 truncate">
                        {hit.duration ? `${hit.duration}s · ` : ""}
                        {hit.user}
                      </span>
                    </button>
                  ))}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowPixabayVideoDialog(false)}>
                    닫기
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Ver2StepShell>
        )
      }

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa] relative overflow-hidden text-zinc-100">
      {/* 배경 글로우 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute -left-20 top-0 h-80 w-80 rounded-full bg-orange-500/15 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-rose-500/10 blur-3xl" />
      </div>

      {showProjectList && (
        <div className="fixed inset-0 z-[5] overflow-y-auto">
          <AiShoppingHome
            projects={projects}
            loading={isLoadingProjects}
            onOpen={(id) => void loadProject(id)}
            onDelete={(id) => void handleDeleteProject(id)}
            onRename={async (id, name) => {
              try {
                await updateShoppingProject(id, { name })
                await loadProjects()
              } catch {
                alert("프로젝트 이름 변경에 실패했습니다.")
              }
            }}
            create={{
              open: showCreateProjectDialog,
              setOpen: (v) => {
                setShowCreateProjectDialog(v)
                if (v) setCreateProjectMode("empty")
              },
              name: newProjectName,
              setName: setNewProjectName,
              description: newProjectDescription,
              setDescription: setNewProjectDescription,
              quality: newProjectQualityMode,
              setQuality: setNewProjectQualityMode,
              saving: isSavingProject,
              submit: () => saveProject(undefined, true),
            }}
          />
        </div>
      )}

      {!showProjectList && (
          <div className="fixed inset-0 z-20 flex bg-[#f5f6fa]">
            {/* 모바일: 사이드바 열릴 때 배경 딤 */}
            {mobileNavOpen ? (
              <button
                type="button"
                aria-label="단계 메뉴 닫기"
                className="fixed inset-0 z-30 bg-black/55 md:hidden"
                onClick={() => setMobileNavOpen(false)}
              />
            ) : null}
            <aside
              className={`light-keep fixed inset-y-0 left-0 z-40 flex h-full w-[min(284px,86vw)] shrink-0 flex-col border-r border-[#e3e6ec] bg-white text-[#0e1016] transition-transform duration-200 ease-out md:static md:z-auto md:w-[248px] md:translate-x-0 ${
                mobileNavOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
              }`}
            >
              <div className="px-5 pb-4 pt-5">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileNavOpen(false)
                      setShowProjectList(true)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg py-1 text-xs font-semibold text-[#5c6170] transition hover:text-[#0e1016] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2f3beb]"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    프로젝트 목록
                  </button>
                  <button
                    type="button"
                    aria-label="메뉴 닫기"
                    onClick={() => setMobileNavOpen(false)}
                    className="rounded-lg p-1.5 text-[#9aa0ad] hover:bg-[#f1f3f7] hover:text-[#0e1016] md:hidden"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-4 text-[11px] font-bold text-[#2f3beb]">AI 쇼핑 숏폼</p>
                <p className="mt-0.5 line-clamp-2 text-[17px] font-black leading-snug tracking-[-0.02em]">
                  {currentProject?.name || "새 프로젝트"}
                </p>
                {(() => {
                  const idx = Math.max(0, VER2_PIPELINE_STEPS.findIndex((x) => x.step === activeStep))
                  return (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex flex-1 gap-[3px]" aria-hidden>
                        {VER2_PIPELINE_STEPS.map((x, k) => (
                          <span key={x.step} className={`h-1 flex-1 rounded-full ${k < idx ? "bg-[#2f3beb]" : k === idx ? "bg-[#2f3beb]/45" : "bg-[#e3e6ec]"}`} />
                        ))}
                      </div>
                      <span className="text-[11px] font-bold tabular-nums text-[#9aa0ad]">{idx + 1}/{VER2_PIPELINE_STEPS.length}</span>
                    </div>
                  )
                })()}
              </div>
              <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="제작 단계">
                <ol className="relative space-y-0.5">
                  {VER2_PIPELINE_STEPS.map((item, index) => {
                    const Icon = item.icon
                    const activeIndex = VER2_PIPELINE_STEPS.findIndex((x) => x.step === activeStep)
                    const isActive = activeStep === item.step
                    const isCompleted = activeIndex > index
                    return (
                      <li key={item.step}>
                        <button
                          type="button"
                          aria-current={isActive ? "step" : undefined}
                          onClick={() => {
                            setActiveStep(item.step)
                            setMobileNavOpen(false)
                          }}
                          className={`group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2f3beb] ${
                            isActive ? "bg-[#0e1016] text-white shadow-[0_10px_24px_-12px_rgba(14,16,22,0.7)]" : "text-[#3a3f4c] hover:bg-[#f5f6fa]"
                          }`}
                        >
                          <span
                            className={`grid h-8 w-8 shrink-0 place-items-center rounded-[10px] transition ${
                              isActive
                                ? "bg-[#2f3beb] text-white"
                                : isCompleted
                                  ? "bg-[#eef0fb] text-[#2f3beb]"
                                  : "bg-[#f1f3f7] text-[#9aa0ad] group-hover:text-[#5c6170]"
                            }`}
                          >
                            {isCompleted && !isActive ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={`block text-[11px] font-semibold tabular-nums ${isActive ? "text-white/55" : "text-[#9aa0ad]"}`}>{index + 1}단계</span>
                            <span className="block truncate text-[14px] font-bold">{item.label}</span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </nav>
              <div className="space-y-2 border-t border-[#eef0f4] p-3">
                <button
                  type="button"
                  onClick={() => {
                    if (currentProject) saveProject()
                    else {
                      setShowCreateProjectDialog(true)
                      setNewProjectName("")
                      setNewProjectDescription("")
                    }
                  }}
                  disabled={isSavingProject || !currentProject}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2f3beb] py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_-12px_rgba(47,59,235,0.8)] transition hover:bg-[#4350ff] disabled:opacity-50"
                >
                  {isSavingProject ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {isSavingProject ? "저장 중" : "저장"}
                </button>
                <Link
                  href="/WingsAIStudioShotForm"
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-[#5c6170] transition hover:bg-[#f5f6fa] hover:text-[#0e1016]"
                >
                  <Home className="h-3.5 w-3.5" />
                  쇼트폼 홈
                </Link>
              </div>
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="light-keep flex items-center justify-between gap-2 border-b border-[#e3e6ec] bg-white/85 px-3 py-3 text-[#0e1016] backdrop-blur-md sm:gap-3 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    aria-label="단계 메뉴 열기"
                    onClick={() => setMobileNavOpen(true)}
                    className="shrink-0 rounded-lg border border-[#e3e6ec] bg-white p-2 text-[#3a3f4c] hover:bg-[#f5f6fa] md:hidden"
                  >
                    <Menu className="h-4 w-4" />
                  </button>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold tabular-nums text-[#9aa0ad]">
                      {Math.max(1, VER2_PIPELINE_STEPS.findIndex((x) => x.step === activeStep) + 1)}단계 / {VER2_PIPELINE_STEPS.length}단계
                    </p>
                    <h2 className="truncate text-lg font-black tracking-[-0.02em] sm:text-xl">
                      {VER2_PIPELINE_STEPS.find((x) => x.step === activeStep)?.label || ""}
                    </h2>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    disabled={VER2_PIPELINE_STEPS.findIndex((x) => x.step === activeStep) <= 0}
                    onClick={() => {
                      const idx = VER2_PIPELINE_STEPS.findIndex((x) => x.step === activeStep)
                      if (idx > 0) setActiveStep(VER2_PIPELINE_STEPS[idx - 1].step)
                    }}
                    className="rounded-xl px-3.5 py-2 text-sm font-bold text-[#5c6170] transition hover:bg-[#f1f3f7] hover:text-[#0e1016] disabled:opacity-35"
                  >
                    ← 이전
                  </button>
                  <button
                    type="button"
                    disabled={VER2_PIPELINE_STEPS.findIndex((x) => x.step === activeStep) >= VER2_PIPELINE_STEPS.length - 1}
                    onClick={() => {
                      const idx = VER2_PIPELINE_STEPS.findIndex((x) => x.step === activeStep)
                      if (idx >= 0 && idx < VER2_PIPELINE_STEPS.length - 1) {
                        setActiveStep(VER2_PIPELINE_STEPS[idx + 1].step)
                      }
                    }}
                    className="rounded-xl bg-[#0e1016] px-4 py-2 text-sm font-bold text-white shadow-[0_10px_24px_-12px_rgba(14,16,22,0.7)] transition hover:bg-[#23262f] disabled:opacity-35"
                  >
                    다음 단계 →
                  </button>
                </div>
              </header>
              <main className="flex-1 overflow-y-auto bg-[#f5f6fa] p-3 sm:p-6 md:p-10">
                {renderStepContent()}
              </main>
            </div>
          </div>
      )}

      <ScriptTemplateManagerDialog
        open={showTemplateManager}
        onOpenChange={setShowTemplateManager}
        selectedId={selectedScriptTemplateId}
        onSelect={setSelectedScriptTemplateId}
      />

        {/* 숨겨진 Canvas (렌더링용) */}
        <canvas
          ref={canvasRef}
          width={1080}
          height={1920}
          className="hidden"
          style={{ width: "1080px", height: "1920px" }}
        />

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

      {/* 윙스봇 챗봇 — 드래그로 위치 이동 가능 */}
      {!isChatbotOpen && (() => {
        const pos = resolveWingsBotPos(false)
        return (
          <button
            type="button"
            onPointerDown={(e) => onWingsBotPointerDown(e, "fab")}
            onPointerMove={onWingsBotPointerMove}
            onPointerUp={onWingsBotPointerUp}
            onPointerCancel={onWingsBotPointerUp}
            className={`light-keep fixed w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center z-50 group touch-none select-none ${
              isDraggingWingsBot ? "cursor-grabbing" : "cursor-grab"
            }`}
            style={{ left: pos.x, top: pos.y, right: "auto", bottom: "auto" }}
            title="윙스봇과 대화하기 (드래그로 이동)"
          >
            <Bot className="w-8 h-8 group-hover:scale-110 transition-transform pointer-events-none" />
          </button>
        )
      })()}

      {isChatbotOpen && (() => {
        const pos = resolveWingsBotPos(true)
        return (
        <div
          className="light-keep fixed w-96 h-[600px] max-h-[calc(100vh-16px)] bg-white rounded-xl shadow-2xl border-2 border-gray-200 flex flex-col z-50"
          style={{ left: pos.x, top: pos.y, right: "auto", bottom: "auto" }}
        >
          {/* 챗봇 헤더 — 여기 잡고 드래그 */}
          <div
            className={`bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 rounded-t-xl flex items-center justify-between touch-none select-none ${
              isDraggingWingsBot ? "cursor-grabbing" : "cursor-grab"
            }`}
            onPointerDown={(e) => onWingsBotPointerDown(e, "panel")}
            onPointerMove={onWingsBotPointerMove}
            onPointerUp={onWingsBotPointerUp}
            onPointerCancel={onWingsBotPointerUp}
            title="드래그하여 이동"
          >
            <div className="flex items-center gap-2 pointer-events-none">
              <Bot className="w-6 h-6" />
              <h3 className="font-bold text-lg">윙스봇</h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onPointerDown={(e) => e.stopPropagation()}
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
                className="flex-1 min-h-[60px] max-h-[120px] resize-none bg-white text-gray-900 caret-gray-900 placeholder:text-gray-400"
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
        )
      })()}

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

    </div>
  )
}



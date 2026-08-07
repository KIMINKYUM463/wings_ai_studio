"use client"

import {
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"
import {
  Clapperboard,
  ExternalLink,
  Film,
  Globe2,
  ImageIcon,
  Loader2,
  Search,
  Sparkles,
  Upload,
  Video,
  WandSparkles,
  Youtube,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  convertImageToVideoWithWan,
  generateImageWithNanobanana,
  generatePixabayKeywordSuggestions,
  generateVideoPromptForImage,
  searchPixabayImages,
  searchPixabayVideos,
  type PixabayImageHit,
  type PixabayVideoHit,
} from "../ai-shopping/actions"
import { fetchCnKeywordTranslation } from "@/lib/shotform-cn-keyword-translate-client"
import {
  DEFAULT_STORY_FRAME_SETTINGS,
  StoryChannelFrame,
} from "./StoryChannelFrame"
import {
  countFilledStoryLineAssets,
  countStorySceneLineSlots,
  getStorySceneMeaningLines,
  isSameStoryAssetSlot,
  resolveStoryLineAsset,
} from "./story-line-assets"
import type { StorySceneAsset, StoryShoppingBrief } from "./story-types"

type SourceMode =
  | "ai"
  | "upload"
  | "stock"
  | "youtube"
  | "google"
  | "xiaohongshu"
  | "douyin"

type ExternalAssetResult = {
  id: string
  title: string
  thumbnailUrl: string
  mediaUrl: string
  pageUrl: string
  mediaType: "image" | "video"
  source: "google" | "youtube" | "xiaohongshu" | "douyin"
  attribution?: string
  license?: string
  durationSec?: number
}

const SOURCE_METHODS: Array<{
  id: SourceMode
  label: string
  description: string
  icon: typeof Sparkles
}> = [
  { id: "ai", label: "AI 생성·영상화", description: "이미지 생성 후 영상 변환", icon: Sparkles },
  { id: "upload", label: "직접 업로드", description: "외부 이미지·영상 추가", icon: Upload },
  { id: "stock", label: "무료 스톡", description: "Pixabay 이미지·영상", icon: ImageIcon },
  { id: "youtube", label: "YouTube CC", description: "관련 영상 자동 추천 팝업", icon: Youtube },
  { id: "google", label: "Google 이미지", description: "제품 이미지 참고 검색", icon: Search },
  { id: "xiaohongshu", label: "샤오홍슈", description: "중국어 변환 후 영상 검색", icon: Globe2 },
  { id: "douyin", label: "도우인", description: "해외 숏폼 영상 검색", icon: Film },
]

function getStoryYoutubeDataApiKey() {
  if (typeof window === "undefined") return ""
  return (localStorage.getItem("shotform_youtube_data_api_key") || "").trim()
}

/** 쿠팡식 긴 상품명 → 앞쪽 핵심만 (서버에서 키워드로 재추출) */
function shortProductHint(name: string) {
  const cleaned = name.replace(/\s+/g, " ").trim()
  if (!cleaned) return ""
  const parts = cleaned.split(/\s+/).filter(Boolean)
  // 브랜드·모델 코드만 잔뜩인 경우에도 앞 5토큰 정도만 전달
  return parts.slice(0, 5).join(" ")
}

export function StoryAssetFindingPanel({
  brief,
  onChange,
}: {
  brief: StoryShoppingBrief
  onChange: Dispatch<SetStateAction<StoryShoppingBrief>>
}) {
  const scenes = brief.generatedStory?.scenes || []
  const [selectedSceneId, setSelectedSceneId] = useState(scenes[0]?.id || "")
  const [selectedLineIndex, setSelectedLineIndex] = useState(0)
  const [sourceMode, setSourceMode] = useState<SourceMode>("ai")
  const [mode, setMode] = useState<"image" | "video">("video")
  const [query, setQuery] = useState("")
  const [images, setImages] = useState<PixabayImageHit[]>([])
  const [videos, setVideos] = useState<PixabayVideoHit[]>([])
  const [externalResults, setExternalResults] = useState<ExternalAssetResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [isImporting, setIsImporting] = useState("")
  const [automationPreset, setAutomationPreset] = useState<
    "smart" | "free" | "ai" | "ai-video"
  >("smart")
  const [isAutomating, setIsAutomating] = useState(false)
  const [automationProgress, setAutomationProgress] = useState("")
  const [keepExistingAssets, setKeepExistingAssets] = useState(true)
  const [error, setError] = useState("")
  const [youtubePopupOpen, setYoutubePopupOpen] = useState(false)
  const [youtubeUsedQuery, setYoutubeUsedQuery] = useState("")
  const [youtubeKeywords, setYoutubeKeywords] = useState<string[]>([])
  const [youtubeProductKeywords, setYoutubeProductKeywords] = useState<string[]>([])
  const [youtubeSituationKeywords, setYoutubeSituationKeywords] = useState<string[]>([])
  const [situationKeywordInput, setSituationKeywordInput] = useState("")
  const [youtubePreviewId, setYoutubePreviewId] = useState<string | null>(null)
  const selectedScene = useMemo(
    () => scenes.find((scene) => scene.id === selectedSceneId) || scenes[0],
    [scenes, selectedSceneId]
  )
  const voiceTrack = brief.voiceData?.tracks.find(
    (item) => item.sceneId === selectedScene?.id
  )
  const meaningLines = useMemo(
    () => (selectedScene ? getStorySceneMeaningLines(selectedScene.narration) : []),
    [selectedScene]
  )
  const lineSlots = useMemo(() => {
    if (voiceTrack?.lineTracks?.length) {
      return voiceTrack.lineTracks.map((item) => ({
        lineIndex: item.lineIndex,
        text: item.text.replace(/\.{2,}|…+/g, "").trim() || item.text,
      }))
    }
    return meaningLines.map((text, lineIndex) => ({ lineIndex, text }))
  }, [meaningLines, voiceTrack])
  const activeLineIndex = Math.min(
    Math.max(0, selectedLineIndex),
    Math.max(0, lineSlots.length - 1)
  )
  const asset = selectedScene
    ? resolveStoryLineAsset(brief.sceneAssets, selectedScene.id, activeLineIndex)
    : undefined
  const frameSettings = {
    ...DEFAULT_STORY_FRAME_SETTINGS,
    videoTitle: brief.generatedStory?.title || DEFAULT_STORY_FRAME_SETTINGS.videoTitle,
    ...brief.frameSettings,
  }

  const applyAsset = (next: StorySceneAsset) => {
    const withLine: StorySceneAsset = {
      ...next,
      lineIndex: next.lineIndex ?? activeLineIndex,
    }
    onChange((current) => ({
      ...current,
      sceneAssets: [
        ...(current.sceneAssets || []).filter((item) => !isSameStoryAssetSlot(item, withLine)),
        withLine,
      ],
    }))
  }

  const recommendAndSearch = async () => {
    if (!selectedScene) return
    setIsSearching(true)
    setError("")
    try {
      const openAiKey = localStorage.getItem("shotform_openai_api_key") || undefined
      const pixabayKey = localStorage.getItem("shotform_pixabay_api_key") || undefined
      const suggestions = await generatePixabayKeywordSuggestions(
        selectedScene.narration,
        brief.productName,
        openAiKey
      )
      const nextQuery = suggestions[0]?.queryEn || selectedScene.visualPrompt
      setQuery(nextQuery)
      if (mode === "video") {
        const result = await searchPixabayVideos(nextQuery, pixabayKey, { perPage: 12 })
        setVideos(result.hits)
        setImages([])
      } else {
        const result = await searchPixabayImages(nextQuery, pixabayKey, {
          perPage: 12,
          orientation: "vertical",
        })
        setImages(result.hits)
        setVideos([])
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "소재 검색에 실패했습니다.")
    } finally {
      setIsSearching(false)
    }
  }

  const search = async () => {
    if (!query.trim()) return
    setIsSearching(true)
    setError("")
    try {
      const key = localStorage.getItem("shotform_pixabay_api_key") || undefined
      if (mode === "video") {
        const result = await searchPixabayVideos(query, key, { perPage: 12 })
        setVideos(result.hits)
        setImages([])
      } else {
        const result = await searchPixabayImages(query, key, {
          perPage: 12,
          orientation: "vertical",
        })
        setImages(result.hits)
        setVideos([])
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "소재 검색에 실패했습니다.")
    } finally {
      setIsSearching(false)
    }
  }

  const generateAiImage = async () => {
    if (!selectedScene) return
    setIsGenerating(true)
    setError("")
    try {
      const url = await generateImageWithNanobanana(
        selectedScene.narration,
        brief.productName,
        brief.productImage,
        localStorage.getItem("shotform_replicate_api_key") || undefined,
        selectedScene.order - 1,
        brief.productDescription,
        "9:16",
        "nano-banana"
      )
      applyAsset({
        sceneId: selectedScene.id,
        mediaUrl: url,
        mediaType: "image",
        source: "ai",
        license: "generated",
        rightsConfirmed: true,
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "AI 이미지 생성에 실패했습니다.")
    } finally {
      setIsGenerating(false)
    }
  }

  const convertCurrentImageToVideo = async () => {
    if (!selectedScene) return
    const imageUrl =
      asset?.mediaType === "image" ? asset.mediaUrl : brief.productImage || ""
    if (!imageUrl) {
      setError("먼저 AI 이미지, 업로드 이미지 또는 검색 이미지를 선택해주세요.")
      return
    }
    setIsConverting(true)
    setError("")
    try {
      const prompt = await generateVideoPromptForImage(
        ((selectedScene.order - 1) % 3) as 0 | 1 | 2,
        brief.productName,
        brief.productDescription,
        Math.min(10, Math.max(5, selectedScene.durationSec)),
        localStorage.getItem("shotform_openai_api_key") || undefined
      )
      const videoUrl = await convertImageToVideoWithWan(
        imageUrl,
        prompt,
        undefined,
        localStorage.getItem("shotform_replicate_api_key") || undefined,
        Math.min(10, Math.max(5, selectedScene.durationSec))
      )
      applyAsset({
        sceneId: selectedScene.id,
        mediaUrl: videoUrl,
        mediaType: "video",
        source: "image-to-video",
        license: asset?.license || "generated",
        rightsConfirmed: asset?.rightsConfirmed ?? true,
        generatedFromImageUrl: imageUrl,
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "이미지 영상화에 실패했습니다.")
    } finally {
      setIsConverting(false)
    }
  }

  const searchExternalAssets = async (options?: { openYoutubePopup?: boolean }) => {
    const searchQuery = query.trim() || `${brief.productName} ${selectedScene.visualPrompt}`
    if (!searchQuery) return
    setIsSearching(true)
    setError("")
    setExternalResults([])
    try {
      if (sourceMode === "youtube" || options?.openYoutubePopup) {
        const youtubeApiKey = getStoryYoutubeDataApiKey()
        if (!youtubeApiKey) {
          throw new Error("설정에서 YouTube Data API Key를 저장한 뒤 다시 시도해주세요.")
        }
        const lineText = lineSlots[activeLineIndex]?.text || ""
        const context = [lineText, selectedScene.visualPrompt].filter(Boolean).join(" · ")
        const productQ = shortProductHint(brief.productName) || shortProductHint(query) || "product"
        const extraKeywords = [query.trim(), situationKeywordInput.trim()]
          .filter(Boolean)
          .join(",")
        const params = new URLSearchParams({
          q: productQ,
          context,
          license: "cc",
          apiKey: youtubeApiKey,
        })
        if (extraKeywords) params.set("keywords", extraKeywords)
        const response = await fetch(
          `/api/shotform/story-shopping/youtube-references?${params.toString()}`
        )
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "YouTube CC 검색에 실패했습니다.")
        const items = (payload.items || []).map(
          (item: {
            id: string
            title: string
            thumbnailUrl: string
            url: string
            channelTitle: string
            durationSec: number
            license?: string
          }) => ({
            id: item.id,
            title: item.title,
            thumbnailUrl: item.thumbnailUrl,
            mediaUrl: "",
            pageUrl: item.url,
            mediaType: "video" as const,
            source: "youtube" as const,
            attribution: item.channelTitle,
            license: item.license || "creativeCommon",
            durationSec: item.durationSec,
          })
        )
        setExternalResults(items)
        setYoutubeKeywords(Array.isArray(payload.keywords) ? payload.keywords : [])
        setYoutubeProductKeywords(
          Array.isArray(payload.productKeywords) ? payload.productKeywords : []
        )
        setYoutubeSituationKeywords(
          Array.isArray(payload.situationKeywords) ? payload.situationKeywords : []
        )
        setYoutubeUsedQuery(String(payload.searchQuery || ""))
        setYoutubePreviewId(null)
        setYoutubePopupOpen(true)
        if (!items.length) {
          setError("관련 Creative Commons 영상을 찾지 못했습니다. 상황 키워드를 바꿔 다시 시도해 주세요.")
        }
        return
      }

      let keywords = [searchQuery]
      if (sourceMode === "xiaohongshu" || sourceMode === "douyin") {
        const translated = await fetchCnKeywordTranslation({
          keywords: [searchQuery],
          openaiApiKey: localStorage.getItem("shotform_openai_api_key"),
          platform: sourceMode,
        })
        keywords = translated.searchQueries
      }
      const response = await fetch("/api/shotform/story-shopping/asset-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: sourceMode,
          query: searchQuery,
          keywords,
          serpApiKey:
            localStorage.getItem("shotform_serpapi_key") ||
            localStorage.getItem("serpapi_api_key") ||
            undefined,
          apifyApiKey: localStorage.getItem("shotform_apify_token") || undefined,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "외부 소재 검색에 실패했습니다.")
      setExternalResults(payload.items || [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "외부 소재 검색에 실패했습니다.")
    } finally {
      setIsSearching(false)
    }
  }

  const openYoutubeCcRelatedPopup = async () => {
    setSourceMode("youtube")
    setError("")
    // sourceMode state는 비동기라 검색 함수에 팝업 플래그를 직접 넘깁니다.
    setIsSearching(true)
    setExternalResults([])
    try {
      const youtubeApiKey = getStoryYoutubeDataApiKey()
      if (!youtubeApiKey) {
        setError("설정에서 YouTube Data API Key를 저장한 뒤 다시 시도해주세요.")
        return
      }
      const lineText = lineSlots[activeLineIndex]?.text || ""
      const context = [lineText, selectedScene?.visualPrompt || ""].filter(Boolean).join(" · ")
      const productQ = shortProductHint(brief.productName) || shortProductHint(query) || "product"
      if (!productQ.trim() && !context && !situationKeywordInput.trim()) {
        setError("상품명·장면·상황 키워드 중 하나 이상이 필요합니다.")
        return
      }
      const extraKeywords = [query.trim(), situationKeywordInput.trim()]
        .filter(Boolean)
        .join(",")
      const params = new URLSearchParams({
        q: productQ,
        context,
        license: "cc",
        apiKey: youtubeApiKey,
      })
      if (extraKeywords) params.set("keywords", extraKeywords)
      const response = await fetch(
        `/api/shotform/story-shopping/youtube-references?${params.toString()}`
      )
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "YouTube CC 검색에 실패했습니다.")
      const items = (payload.items || []).map(
        (item: {
          id: string
          title: string
          thumbnailUrl: string
          url: string
          channelTitle: string
          durationSec: number
          license?: string
        }) => ({
          id: item.id,
          title: item.title,
          thumbnailUrl: item.thumbnailUrl,
          mediaUrl: "",
          pageUrl: item.url,
          mediaType: "video" as const,
          source: "youtube" as const,
          attribution: item.channelTitle,
          license: item.license || "creativeCommon",
          durationSec: item.durationSec,
        })
      )
      setExternalResults(items)
      setYoutubeKeywords(Array.isArray(payload.keywords) ? payload.keywords : [])
      setYoutubeProductKeywords(
        Array.isArray(payload.productKeywords) ? payload.productKeywords : []
      )
      setYoutubeSituationKeywords(
        Array.isArray(payload.situationKeywords) ? payload.situationKeywords : []
      )
      setYoutubeUsedQuery(String(payload.searchQuery || ""))
      setYoutubePreviewId(null)
      setYoutubePopupOpen(true)
      if (!items.length) {
        setError("관련 Creative Commons 영상을 찾지 못했습니다. 상황 키워드를 바꿔 다시 시도해 주세요.")
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "YouTube CC 검색에 실패했습니다.")
    } finally {
      setIsSearching(false)
    }
  }

  const importExternalAsset = async (item: ExternalAssetResult) => {
    if (!brief.assetRightsConfirmed) {
      setError("외부 소재의 이용 권리를 확인한 후 선택해주세요.")
      return
    }
    if (item.mediaType === "image") {
      applyAsset({
        sceneId: selectedScene.id,
        mediaUrl: item.mediaUrl,
        mediaType: "image",
        source: item.source,
        sourcePageUrl: item.pageUrl,
        attribution: item.attribution,
        license: "permission-confirmed",
        rightsConfirmed: true,
      })
      if (item.source === "youtube") setYoutubePopupOpen(false)
      return
    }
    setIsImporting(item.id)
    setError("")
    try {
      const response = await fetch("/api/shotform/mvp-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apifyApiKey: localStorage.getItem("shotform_apify_token") || undefined,
          items: [
            {
              url: item.pageUrl,
              videoUrl: item.mediaUrl,
              platform: item.source,
              title: item.title,
            },
          ],
        }),
      })
      const payload = await response.json()
      const result = payload.results?.[0]
      if (!response.ok || !result?.downloadUrl) {
        throw new Error(result?.error || payload.error || "영상 재생 주소를 가져오지 못했습니다.")
      }
      applyAsset({
        sceneId: selectedScene.id,
        mediaUrl: result.downloadUrl,
        mediaType: "video",
        source: item.source,
        sourcePageUrl: item.pageUrl,
        attribution: item.attribution,
        license: item.source === "youtube" ? "youtube-cc" : "permission-confirmed",
        rightsConfirmed: true,
      })
      if (item.source === "youtube") setYoutubePopupOpen(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "영상 가져오기에 실패했습니다.")
    } finally {
      setIsImporting("")
    }
  }

  const runAiAutomation = async () => {
    if (!scenes.length) return
    const openAiKey = localStorage.getItem("shotform_openai_api_key") || undefined
    const pixabayKey = localStorage.getItem("shotform_pixabay_api_key") || undefined
    const replicateKey =
      localStorage.getItem("shotform_replicate_api_key") || undefined
    if ((automationPreset === "free" || automationPreset === "smart") && !pixabayKey) {
      setError("무료 소재 자동 검색을 위해 Pixabay API 키가 필요합니다.")
      return
    }
    if (
      (automationPreset === "ai" ||
        automationPreset === "ai-video" ||
        automationPreset === "smart") &&
      !replicateKey
    ) {
      setError("AI 소재 자동 생성을 위해 Replicate API 키가 필요합니다.")
      return
    }

    setIsAutomating(true)
    setError("")
    let completed = 0
    let totalSlots = 0
    const failedSlots: string[] = []
    const filledKeys = new Set(
      (brief.sceneAssets || [])
        .filter((item) => item.mediaUrl)
        .map((item) => `${item.sceneId}:${item.lineIndex ?? 0}`)
    )
    try {
      for (let index = 0; index < scenes.length; index += 1) {
        const scene = scenes[index]
        const track = brief.voiceData?.tracks.find((item) => item.sceneId === scene.id)
        const slotCount = countStorySceneLineSlots(scene, track)
        const lines = getStorySceneMeaningLines(scene.narration)
        totalSlots += slotCount

        for (let lineIndex = 0; lineIndex < slotCount; lineIndex += 1) {
          const lineText = lines[lineIndex] || scene.narration
          const slotKey = `${scene.id}:${lineIndex}`
          if (keepExistingAssets && filledKeys.has(slotKey)) {
            completed += 1
            setAutomationProgress(
              `장면 ${index + 1} · 줄 ${lineIndex + 1}/${slotCount} · 기존 소재 유지`
            )
            continue
          }

          setAutomationProgress(
            `장면 ${index + 1}/${scenes.length} · 줄 ${lineIndex + 1}/${slotCount} · 소재 찾는 중`
          )
          try {
            const productRevealScene = index >= Math.floor(scenes.length * 0.68)
            const shouldUseStock =
              automationPreset === "free" ||
              (automationPreset === "smart" && !productRevealScene)
            let nextAsset: StorySceneAsset | null = null

            if (shouldUseStock) {
              let stockQuery = scene.visualPrompt || brief.productName
              if (openAiKey) {
                const suggestions = await generatePixabayKeywordSuggestions(
                  lineText,
                  brief.productName,
                  openAiKey
                )
                stockQuery = suggestions[0]?.queryEn || stockQuery
              }
              const preferVideo = (index + lineIndex) % 2 === 0
              if (preferVideo) {
                const result = await searchPixabayVideos(stockQuery, pixabayKey, {
                  perPage: 8,
                })
                const picked =
                  result.hits[(lineIndex + index) % Math.max(1, result.hits.length)]
                if (picked) {
                  nextAsset = {
                    sceneId: scene.id,
                    lineIndex,
                    mediaUrl: picked.videoURL,
                    mediaType: "video",
                    source: "pixabay",
                    sourcePageUrl: picked.pageURL,
                    attribution: picked.user,
                    license: "pixabay",
                    rightsConfirmed: true,
                  }
                }
              }
              if (!nextAsset) {
                const result = await searchPixabayImages(stockQuery, pixabayKey, {
                  perPage: 8,
                  orientation: "vertical",
                })
                const picked =
                  result.hits[(lineIndex + index) % Math.max(1, result.hits.length)]
                if (picked) {
                  nextAsset = {
                    sceneId: scene.id,
                    lineIndex,
                    mediaUrl: picked.largeImageURL || picked.webformatURL,
                    mediaType: "image",
                    source: "pixabay",
                    sourcePageUrl: picked.pageURL,
                    attribution: picked.user,
                    license: "pixabay",
                    rightsConfirmed: true,
                  }
                }
              }
            }

            if (!nextAsset && automationPreset !== "free") {
              setAutomationProgress(
                `장면 ${index + 1} · 줄 ${lineIndex + 1}/${slotCount} · AI 이미지 생성 중`
              )
              const imageUrl = await generateImageWithNanobanana(
                lineText,
                brief.productName,
                brief.productImage,
                replicateKey,
                index * 10 + lineIndex,
                brief.productDescription,
                "9:16",
                "nano-banana"
              )
              nextAsset = {
                sceneId: scene.id,
                lineIndex,
                mediaUrl: imageUrl,
                mediaType: "image",
                source: "ai",
                license: "generated",
                rightsConfirmed: true,
              }

              if (automationPreset === "ai-video") {
                setAutomationProgress(
                  `장면 ${index + 1} · 줄 ${lineIndex + 1}/${slotCount} · 영상 변환 중`
                )
                const prompt = await generateVideoPromptForImage(
                  ((index + lineIndex) % 3) as 0 | 1 | 2,
                  brief.productName,
                  brief.productDescription,
                  Math.min(10, Math.max(5, Math.ceil(scene.durationSec / slotCount))),
                  openAiKey
                )
                const videoUrl = await convertImageToVideoWithWan(
                  imageUrl,
                  prompt,
                  undefined,
                  replicateKey,
                  Math.min(10, Math.max(5, Math.ceil(scene.durationSec / slotCount)))
                )
                nextAsset = {
                  ...nextAsset,
                  mediaUrl: videoUrl,
                  mediaType: "video",
                  source: "image-to-video",
                  generatedFromImageUrl: imageUrl,
                }
              }
            }

            if (!nextAsset) throw new Error("사용할 수 있는 소재를 찾지 못했습니다.")
            applyAsset(nextAsset)
            filledKeys.add(slotKey)
            completed += 1
          } catch {
            failedSlots.push(`${index + 1}-${lineIndex + 1}`)
          }
        }
      }
      setAutomationProgress(
        failedSlots.length
          ? `${completed}/${totalSlots}개 줄 완료 · 실패 ${failedSlots.join(", ")}`
          : `${totalSlots}개 대본 줄 소재 자동 구성 완료 · 줄별로 검토해주세요.`
      )
    } finally {
      setIsAutomating(false)
    }
  }

  const upload = (file?: File) => {
    if (!file || !selectedScene) return
    const reader = new FileReader()
    reader.onload = () =>
      applyAsset({
        sceneId: selectedScene.id,
        mediaUrl: String(reader.result || ""),
        mediaType: file.type.startsWith("video/") ? "video" : "image",
        source: "upload",
        license: "owned",
        rightsConfirmed: true,
      })
    reader.readAsDataURL(file)
  }

  if (!selectedScene) {
    return (
      <div className="rounded-[28px] border border-dashed border-white/15 py-24 text-center text-zinc-400">
        스토리 대본을 먼저 생성해주세요.
      </div>
    )
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[300px_1fr]">
      <section className="rounded-[28px] border border-white/10 bg-[#0d0d0c] p-4">
        <div className="flex items-center gap-2 px-1 text-[9px] font-black tracking-[0.18em] text-emerald-300">
          <Clapperboard className="h-4 w-4" />
          SCENE ASSETS
        </div>
        <div className="mt-4 space-y-2">
          {scenes.map((scene, index) => {
            const track = brief.voiceData?.tracks.find((item) => item.sceneId === scene.id)
            const slots = countStorySceneLineSlots(scene, track)
            const filled = countFilledStoryLineAssets(brief.sceneAssets, scene, slots)
            const lineAsset = resolveStoryLineAsset(brief.sceneAssets, scene.id, 0)
            return (
              <button
                type="button"
                key={scene.id}
                onClick={() => {
                  setSelectedSceneId(scene.id)
                  setSelectedLineIndex(0)
                }}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedScene.id === scene.id
                    ? "border-emerald-300/50 bg-emerald-500/10"
                    : "border-white/10 bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-emerald-200">장면 {index + 1}</span>
                  <span className="flex items-center gap-1.5 text-[9px] text-zinc-400">
                    {filled}/{slots}줄
                    <span className={filled >= slots ? "text-emerald-300" : "text-zinc-600"}>
                      {lineAsset?.mediaType === "video" ? (
                        <Video className="h-3.5 w-3.5" />
                      ) : (
                        <ImageIcon className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-[10px] leading-5 text-zinc-400">
                  {scene.narration}
                </p>
              </button>
            )
          })}
        </div>
      </section>

      <section className="rounded-[28px] border border-emerald-400/15 bg-[#0b0e0c] p-5">
        <h2 className="text-xl font-black text-white">장면 {selectedScene.order} 소재 찾기</h2>
        <p className="mt-2 text-xs leading-6 text-zinc-400">{selectedScene.visualPrompt}</p>

        <div className="mt-4 space-y-2">
          <p className="text-[9px] font-black tracking-[0.14em] text-amber-300">
            대본 줄별 소재 슬롯 (TTS 한 줄 = 영상/이미지 1개)
          </p>
          <div className="flex flex-wrap gap-2">
            {lineSlots.map((slot) => {
              const slotAsset = resolveStoryLineAsset(
                brief.sceneAssets,
                selectedScene.id,
                slot.lineIndex
              )
              const active = activeLineIndex === slot.lineIndex
              return (
                <button
                  key={`${selectedScene.id}-line-${slot.lineIndex}`}
                  type="button"
                  onClick={() => setSelectedLineIndex(slot.lineIndex)}
                  className={`max-w-full rounded-xl border px-3 py-2 text-left transition ${
                    active
                      ? "border-amber-300/60 bg-amber-500/15"
                      : "border-white/10 bg-white/[0.03] hover:border-white/25"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-amber-200">
                      {slot.lineIndex + 1}줄
                    </span>
                    <span
                      className={`text-[9px] ${slotAsset ? "text-emerald-300" : "text-zinc-600"}`}
                    >
                      {slotAsset ? "소재 있음" : "비어 있음"}
                    </span>
                  </div>
                  <p className="mt-1 max-w-[220px] truncate text-[10px] text-zinc-300">
                    {slot.text}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]">
          <div>
            <div className="overflow-hidden rounded-2xl border border-emerald-400/20 bg-black">
              <StoryChannelFrame
                settings={frameSettings}
                scene={selectedScene}
                asset={asset}
                fallbackMediaUrl={brief.productImage}
                activeNarrationLine={activeLineIndex}
                narrationDisplayLines={lineSlots.map((slot) => slot.text)}
              />
            </div>
            {voiceTrack ? (
              <div className="mt-3 space-y-2">
                <audio controls src={voiceTrack.audioUrl} className="h-8 w-full" />
                <p className="text-[9px] text-zinc-500">장면 통 TTS · 아래는 자막 단위</p>
                {(voiceTrack.lineTracks?.length
                  ? voiceTrack.lineTracks
                  : [{ lineIndex: 0, text: selectedScene.narration }]
                ).map((lineTrack) => (
                  <div key={`${voiceTrack.sceneId}-${lineTrack.lineIndex}`}>
                    <p className="truncate text-[9px] text-cyan-200/70">
                      자막 {lineTrack.lineIndex + 1} · {lineTrack.text}
                    </p>
                    {lineTrack.audioUrl && lineTrack.audioUrl !== voiceTrack.audioUrl ? (
                      <audio controls src={lineTrack.audioUrl} className="mt-1 h-8 w-full" />
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-center text-[9px] text-zinc-500">
                이 장면의 TTS가 없습니다. 음성 단계에서 통 TTS를 생성하면 더 자연스럽습니다.
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[9px] font-black tracking-[0.14em] text-cyan-300">
              LINE {activeLineIndex + 1} SLOT
            </p>
            <h3 className="mt-2 text-sm font-black text-white">
              지금 고른 소재는 {activeLineIndex + 1}번째 대본 줄에 들어갑니다.
            </h3>
            <p className="mt-2 text-[11px] leading-6 text-zinc-400">
              벤치마크처럼 TTS 한 줄이 바뀔 때마다 영상/이미지가 바뀌려면, 위 줄 슬롯마다
              소재를 넣어 주세요. 자동 구성도 줄 단위로 채웁니다.
            </p>
            <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-3 text-[10px] leading-5 text-amber-50/90">
              현재 줄: {lineSlots[activeLineIndex]?.text || selectedScene.narration}
            </div>
            <div className="mt-4 rounded-xl border border-violet-400/15 bg-violet-500/[0.06] p-3">
              <p className="text-[9px] font-bold text-violet-200">화면 연출 가이드</p>
              <p className="mt-2 text-[10px] leading-5 text-zinc-300">
                {selectedScene.visualPrompt}
              </p>
            </div>
            {asset?.mediaType === "video" ? (
              <div className="mt-4 rounded-xl border border-cyan-400/15 bg-cyan-500/[0.05] p-3">
                <p className="text-[9px] font-black tracking-[0.12em] text-cyan-200">
                  수동 편집 · 사용할 구간
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="text-[9px] text-zinc-500">
                    시작 초
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={asset.trimStartSec ?? 0}
                      onChange={(event) =>
                        applyAsset({
                          ...asset,
                          trimStartSec: Math.max(0, Number(event.target.value) || 0),
                        })
                      }
                      className="mt-1 h-9 border-white/10 bg-black/25 text-white"
                    />
                  </label>
                  <label className="text-[9px] text-zinc-500">
                    종료 초
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={asset.trimEndSec ?? ""}
                      placeholder="전체"
                      onChange={(event) =>
                        applyAsset({
                          ...asset,
                          trimEndSec: event.target.value
                            ? Math.max(0, Number(event.target.value) || 0)
                            : undefined,
                        })
                      }
                      className="mt-1 h-9 border-white/10 bg-black/25 text-white"
                    />
                  </label>
                </div>
                <Input
                  value={asset.editorNote || ""}
                  onChange={(event) =>
                    applyAsset({ ...asset, editorNote: event.target.value })
                  }
                  placeholder="예: 제품을 누르는 순간부터 사용"
                  className="mt-2 h-9 border-white/10 bg-black/25 text-xs text-white"
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/[0.08] via-black/20 to-violet-500/[0.08] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[9px] font-black tracking-[0.16em] text-cyan-300">
                <WandSparkles className="h-4 w-4" />
                AI AUTOMATION MODE
              </div>
              <h3 className="mt-2 text-lg font-black text-white">
                전체 장면 소재를 AI가 먼저 구성합니다.
              </h3>
              <p className="mt-1 text-[10px] leading-5 text-zinc-400">
                자동 배치 후 장면별 검색·교체·구간 편집으로 완성도를 높일 수 있습니다.
              </p>
            </div>
            <Button
              onClick={runAiAutomation}
              disabled={isAutomating}
              className="h-11 bg-gradient-to-r from-cyan-400 to-violet-500 px-5 font-black text-slate-950 hover:from-cyan-300 hover:to-violet-400"
            >
              {isAutomating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {isAutomating ? "자동 구성 중" : "전체 장면 자동 구성"}
            </Button>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                id: "smart" as const,
                label: "AI 스마트 믹스",
                note: "초반 무료 영상 + 제품 장면 AI",
              },
              {
                id: "free" as const,
                label: "무료 소재 우선",
                note: "Pixabay 이미지·영상만 사용",
              },
              {
                id: "ai" as const,
                label: "AI 이미지",
                note: "모든 장면을 AI 이미지로 생성",
              },
              {
                id: "ai-video" as const,
                label: "AI 영상",
                note: "AI 이미지 생성 후 영상화 · 비용 높음",
              },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setAutomationPreset(preset.id)}
                className={`rounded-xl border p-3 text-left transition ${
                  automationPreset === preset.id
                    ? "border-cyan-300/55 bg-cyan-500/10"
                    : "border-white/10 bg-black/20 hover:border-white/25"
                }`}
              >
                <p className="text-[11px] font-black text-white">{preset.label}</p>
                <p className="mt-1 text-[9px] leading-4 text-zinc-500">{preset.note}</p>
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-[10px] text-zinc-300">
              <Checkbox
                checked={keepExistingAssets}
                onCheckedChange={(checked) => setKeepExistingAssets(checked === true)}
              />
              이미 선택한 장면 소재는 유지
            </label>
            {automationProgress ? (
              <p className="text-[10px] font-bold text-cyan-200">{automationProgress}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-6">
          <p className="text-[9px] font-black tracking-[0.16em] text-emerald-300">
            ASSET WORKBENCH
          </p>
          <h3 className="mt-1 text-base font-black text-white">
            자동 검색 후 사람이 장면에 맞는 소재를 선택합니다.
          </h3>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {SOURCE_METHODS.map((method) => {
              const Icon = method.icon
              const active = sourceMode === method.id
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => {
                    if (method.id === "youtube") {
                      void openYoutubeCcRelatedPopup()
                      return
                    }
                    setSourceMode(method.id)
                    setExternalResults([])
                    setError("")
                  }}
                  className={`rounded-xl border p-3 text-left transition ${
                    active
                      ? "border-emerald-300/55 bg-emerald-500/10"
                      : "border-white/10 bg-white/[0.025] hover:border-white/25"
                  }`}
                >
                  <Icon className={active ? "h-4 w-4 text-emerald-200" : "h-4 w-4 text-zinc-500"} />
                  <p className="mt-2 text-xs font-black text-white">{method.label}</p>
                  <p className="mt-1 text-[9px] text-zinc-500">{method.description}</p>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
          {sourceMode === "ai" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Button onClick={generateAiImage} disabled={isGenerating} className="h-12 bg-violet-500 font-black text-white hover:bg-violet-400">
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                이 장면 AI 이미지 생성
              </Button>
              <Button onClick={convertCurrentImageToVideo} disabled={isConverting} className="h-12 bg-cyan-500 font-black text-cyan-950 hover:bg-cyan-300">
                {isConverting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
                현재 이미지를 영상으로 변환
              </Button>
              <p className="text-[10px] leading-5 text-zinc-500 sm:col-span-2">
                먼저 장면 이미지를 만든 뒤 영상화할 수 있습니다. 제품이 갑자기 움직이거나
                변형되지 않도록 장면 연출 프롬프트를 자동 생성합니다.
              </p>
            </div>
          ) : null}

          {sourceMode === "upload" ? (
            <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-emerald-300/30 bg-emerald-500/[0.04] text-zinc-200 transition hover:bg-emerald-500/[0.08]">
              <Upload className="mb-2 h-6 w-6 text-emerald-300" />
              <span className="text-sm font-black">외부 이미지 또는 영상 선택</span>
              <span className="mt-1 text-[10px] text-zinc-500">
                직접 촬영했거나 사용 권한이 있는 파일을 권장합니다.
              </span>
              <input type="file" accept="image/*,video/*" className="hidden" onChange={(event) => upload(event.target.files?.[0])} />
            </label>
          ) : null}

          {sourceMode === "stock" ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setMode("video")} className={mode === "video" ? "border-emerald-300 bg-emerald-500/15 text-white" : "border-white/15 bg-black/20 text-zinc-300"}>
                  <Video className="mr-2 h-4 w-4" /> Pixabay 영상
                </Button>
                <Button variant="outline" onClick={() => setMode("image")} className={mode === "image" ? "border-emerald-300 bg-emerald-500/15 text-white" : "border-white/15 bg-black/20 text-zinc-300"}>
                  <ImageIcon className="mr-2 h-4 w-4" /> Pixabay 이미지
                </Button>
              </div>
              <div className="mt-3 flex gap-2">
                <Input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void search()} placeholder="영문 무료 소재 검색어" className="border-white/10 bg-black/30 text-white" />
                <Button onClick={search} disabled={isSearching} className="bg-emerald-500 font-bold text-black hover:bg-emerald-300">
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
                <Button variant="outline" onClick={recommendAndSearch} disabled={isSearching} className="border-white/15 bg-white/[0.04] text-white">
                  AI 검색어
                </Button>
              </div>
            </>
          ) : null}

          {sourceMode === "youtube" ? (
            <>
              <div className="rounded-xl border border-red-400/20 bg-red-500/[0.06] p-3 text-[10px] leading-5 text-red-50/90">
                긴 검색어가 아니라 <span className="font-bold text-white">짧은 키워드</span>로
                찾습니다. 제품 키워드 + 상황(캠핑·음료 따르기 등) 키워드를 나눠 여러 번 검색한 뒤
                팝업으로 모읍니다.
              </div>
              <div className="mt-3 space-y-2">
                <Input
                  value={situationKeywordInput}
                  onChange={(event) => setSituationKeywordInput(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void openYoutubeCcRelatedPopup()}
                  placeholder="상황 키워드 (예: camping pouring drink, campsite)"
                  className="border-white/10 bg-black/30 text-white"
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void openYoutubeCcRelatedPopup()}
                  placeholder="추가 키워드 (선택) · 영문 권장"
                  className="border-white/10 bg-black/30 text-white"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  onClick={() => void openYoutubeCcRelatedPopup()}
                  disabled={isSearching}
                  className="bg-red-500 font-black text-white hover:bg-red-400"
                >
                  {isSearching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Youtube className="mr-2 h-4 w-4" />
                  )}
                  키워드로 관련 CC 영상 찾기
                </Button>
                {externalResults.length > 0 ? (
                  <Button
                    variant="outline"
                    onClick={() => setYoutubePopupOpen(true)}
                    className="border-white/15 bg-white/[0.04] text-white"
                  >
                    결과 팝업 다시 열기 ({externalResults.length})
                  </Button>
                ) : null}
              </div>
              <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-3">
                <Checkbox
                  checked={brief.assetRightsConfirmed}
                  onCheckedChange={(checked) =>
                    onChange((current) => ({
                      ...current,
                      assetRightsConfirmed: checked === true,
                    }))
                  }
                />
                <span className="text-[10px] leading-5 text-amber-100/80">
                  원본 페이지의 라이선스·출처·상업적 재가공 가능 여부를 직접 확인했습니다.
                  Creative Commons라도 용도에 맞는지 확인이 필요합니다.
                </span>
              </label>
            </>
          ) : null}

          {sourceMode === "google" ||
          sourceMode === "xiaohongshu" ||
          sourceMode === "douyin" ? (
            <>
              <div className="flex gap-2">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void searchExternalAssets()}
                  placeholder={
                    sourceMode === "google"
                      ? "Google 제품 이미지 검색어"
                      : "한국어로 해외 영상 검색어 입력"
                  }
                  className="border-white/10 bg-black/30 text-white"
                />
                <Button onClick={searchExternalAssets} disabled={isSearching} className="bg-emerald-500 font-bold text-black hover:bg-emerald-300">
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-3">
                <Checkbox
                  checked={brief.assetRightsConfirmed}
                  onCheckedChange={(checked) =>
                    onChange((current) => ({
                      ...current,
                      assetRightsConfirmed: checked === true,
                    }))
                  }
                />
                <span className="text-[10px] leading-5 text-amber-100/80">
                  원본 페이지의 라이선스·출처·상업적 재가공 가능 여부를 직접 확인했습니다.
                  검색 가능 여부와 재사용 권리는 서로 다릅니다.
                </span>
              </label>
            </>
          ) : null}
        </div>

        {error ? (
          <p className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200">
            {error}
          </p>
        ) : null}

        {sourceMode === "stock" ? (
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {videos.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() =>
                  applyAsset({
                    sceneId: selectedScene.id,
                    mediaUrl: item.videoURL,
                    mediaType: "video",
                    source: "pixabay",
                    sourcePageUrl: item.pageURL,
                    attribution: item.user,
                    license: "pixabay",
                    rightsConfirmed: true,
                  })
                }
                className="group overflow-hidden rounded-xl border border-white/10 bg-black text-left hover:border-emerald-300/50"
              >
                <img src={item.previewURL} alt={item.tags} className="aspect-[9/16] w-full object-cover" />
                <p className="truncate p-2 text-[9px] text-zinc-400">{item.tags}</p>
              </button>
            ))}
            {images.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() =>
                  applyAsset({
                    sceneId: selectedScene.id,
                    mediaUrl: item.largeImageURL || item.webformatURL,
                    mediaType: "image",
                    source: "pixabay",
                    sourcePageUrl: item.pageURL,
                    attribution: item.user,
                    license: "pixabay",
                    rightsConfirmed: true,
                  })
                }
                className="group overflow-hidden rounded-xl border border-white/10 bg-black text-left hover:border-emerald-300/50"
              >
                <img src={item.webformatURL} alt={item.tags} className="aspect-[9/16] w-full object-cover" />
                <p className="truncate p-2 text-[9px] text-zinc-400">{item.tags}</p>
              </button>
            ))}
          </div>
        ) : null}

        {externalResults.length > 0 && sourceMode !== "youtube" ? (
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {externalResults.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-xl border border-white/10 bg-black">
                <img src={item.thumbnailUrl || item.mediaUrl} alt={item.title} className="aspect-[9/16] w-full object-cover" />
                <div className="p-3">
                  <p className="line-clamp-2 text-[10px] font-bold leading-4 text-zinc-200">{item.title}</p>
                  <p className="mt-1 truncate text-[9px] text-zinc-500">
                    {item.attribution || item.source}
                    {item.durationSec ? ` · ${item.durationSec}초` : ""}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <a href={item.pageUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center justify-center rounded-md border border-white/10 bg-white/5 text-[9px] font-bold text-zinc-300 hover:bg-white/10">
                      <ExternalLink className="mr-1 h-3 w-3" /> 원본 확인
                    </a>
                    <button
                      type="button"
                      onClick={() => void importExternalAsset(item)}
                      disabled={isImporting === item.id}
                      className="inline-flex h-8 items-center justify-center rounded-md bg-emerald-500 text-[9px] font-black text-black hover:bg-emerald-300 disabled:opacity-50"
                    >
                      {isImporting === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "장면에 넣기"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <Dialog open={youtubePopupOpen} onOpenChange={setYoutubePopupOpen}>
        <DialogContent className="max-h-[90vh] w-[min(960px,95vw)] max-w-[960px] overflow-hidden border-white/10 bg-[#0c0e10] p-0 text-zinc-100">
          <DialogHeader className="border-b border-white/10 px-5 py-4">
            <DialogTitle className="flex items-center gap-2 text-base font-black text-white">
              <Youtube className="h-5 w-5 text-red-400" />
              관련 YouTube CC 영상
            </DialogTitle>
            <DialogDescription className="text-[11px] leading-5 text-zinc-400">
              제품 키워드와 상황 키워드로 나눠 검색한 결과입니다. 원하는 영상을 고르면 현재 줄
              슬롯에 들어갑니다.
            </DialogDescription>
            {(youtubeProductKeywords.length > 0 ||
              youtubeSituationKeywords.length > 0 ||
              youtubeKeywords.length > 0) && (
              <div className="mt-3 space-y-2">
                {youtubeProductKeywords.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[9px] font-black text-emerald-300">제품</span>
                    {youtubeProductKeywords.map((keyword) => (
                      <span
                        key={`p-${keyword}`}
                        className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] text-emerald-100"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                ) : null}
                {youtubeSituationKeywords.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[9px] font-black text-amber-300">상황</span>
                    {youtubeSituationKeywords.map((keyword) => (
                      <span
                        key={`s-${keyword}`}
                        className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[9px] text-amber-100"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                ) : null}
                {youtubeKeywords.length > 0 &&
                !youtubeProductKeywords.length &&
                !youtubeSituationKeywords.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {youtubeKeywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[9px] text-zinc-300"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </DialogHeader>

          <div className="max-h-[calc(90vh-88px)] overflow-y-auto px-5 py-4">
            {isSearching ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-400">
                <Loader2 className="h-5 w-5 animate-spin text-red-400" />
                관련 Creative Commons 영상을 찾는 중…
              </div>
            ) : externalResults.length === 0 ? (
              <div className="py-16 text-center text-sm text-zinc-500">
                결과가 없습니다. 검색어를 바꿔 「관련 CC 영상 다시 찾기」를 눌러 주세요.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
                  {youtubePreviewId ? (
                    <iframe
                      title="YouTube CC preview"
                      src={`https://www.youtube.com/embed/${youtubePreviewId}?rel=0`}
                      className="aspect-video w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center text-xs text-zinc-500">
                      왼쪽 목록에서 영상을 클릭하면 미리보기가 나옵니다.
                    </div>
                  )}
                </div>
                <div className="grid max-h-[60vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {externalResults
                    .filter((item) => item.source === "youtube")
                    .map((item) => {
                      const active = youtubePreviewId === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setYoutubePreviewId(item.id)}
                          className={`overflow-hidden rounded-xl border text-left transition ${
                            active
                              ? "border-red-400/60 bg-red-500/10"
                              : "border-white/10 bg-white/[0.03] hover:border-white/25"
                          }`}
                        >
                          <img
                            src={item.thumbnailUrl}
                            alt={item.title}
                            className="aspect-video w-full object-cover"
                          />
                          <div className="p-2">
                            <p className="line-clamp-2 text-[10px] font-bold leading-4 text-zinc-200">
                              {item.title}
                            </p>
                            <p className="mt-1 truncate text-[9px] text-zinc-500">
                              {item.attribution}
                              {item.durationSec ? ` · ${item.durationSec}초` : ""}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                </div>
              </div>
            )}

            {youtubePreviewId ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                <a
                  href={`https://www.youtube.com/watch?v=${youtubePreviewId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 text-xs font-bold text-zinc-300 hover:bg-white/10"
                >
                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                  원본 확인
                </a>
                <Button
                  onClick={() => {
                    const item = externalResults.find((entry) => entry.id === youtubePreviewId)
                    if (item) void importExternalAsset(item)
                  }}
                  disabled={isImporting === youtubePreviewId || !brief.assetRightsConfirmed}
                  className="h-10 bg-emerald-500 font-black text-black hover:bg-emerald-300"
                >
                  {isImporting === youtubePreviewId ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  이 영상을 {activeLineIndex + 1}줄에 넣기
                </Button>
                {!brief.assetRightsConfirmed ? (
                  <p className="w-full text-[10px] text-amber-200/80">
                    팝업 밖 권리 확인 체크박스를 먼저 켜 주세요.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

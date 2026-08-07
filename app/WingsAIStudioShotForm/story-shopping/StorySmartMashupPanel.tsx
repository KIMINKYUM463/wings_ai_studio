"use client"

import { useMemo, useState, type Dispatch, type SetStateAction } from "react"
import {
  Check,
  Clapperboard,
  ExternalLink,
  Film,
  Loader2,
  Scissors,
  Search,
  ShoppingCart,
  Trash2,
  Wand2,
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
  generateImageWithNanobanana,
  generatePixabayKeywordSuggestions,
  searchPixabayVideos,
} from "../ai-shopping/actions"
import { isSameStoryAssetSlot } from "./story-line-assets"
import {
  buildStoryMashupLineSlots,
  poolItemToSceneAsset,
} from "./story-mashup"
import type {
  StoryMediaPoolItem,
  StoryMashupSettings,
  StorySceneAsset,
  StoryShoppingBrief,
} from "./story-types"
import { DEFAULT_STORY_MASHUP_SETTINGS } from "./story-types"

function getYoutubeKey() {
  return (localStorage.getItem("shotform_youtube_data_api_key") || "").trim()
}

function getSerpKey() {
  return (
    localStorage.getItem("shotform_serpapi_key") ||
    localStorage.getItem("serpapi_api_key") ||
    ""
  ).trim()
}

/** 쿠팡 긴 상품명 → 검색용 핵심어 (브랜드·제품명 위주) */
function productSearchQuery(name: string, description?: string) {
  const cleaned = name
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\d+\s*(ml|g|kg|개|팩|입|매|세트|L|cm|mm|인치)/gi, " ")
    .replace(/[|/·•]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  const words = cleaned.split(/\s+/).filter((word) => word.length > 1)
  const core = words.slice(0, 8).join(" ")
  if (core.length >= 4) return core
  const fromDesc = (description || "").replace(/\s+/g, " ").trim().slice(0, 40)
  return fromDesc || name.slice(0, 48) || "product"
}

/** 쿠팡에서 고른 제품 메인 사진 URL */
function resolveProductMainImage(brief: StoryShoppingBrief): string {
  const candidates = [
    brief.productImage,
    brief.selectedShoppingTag?.imageUrl,
    ...(brief.collectorData?.productImages || []),
  ]
  for (const raw of candidates) {
    const url = String(raw || "").trim()
    if (url.startsWith("http://") || url.startsWith("https://")) return url
  }
  return ""
}

function makePoolId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

type CandidateVideo = {
  id: string
  title: string
  thumbnailUrl: string
  pageUrl: string
  mediaUrl: string
  mediaType: "image" | "video"
  durationSec?: number
  attribution?: string
  source: "google" | "youtube" | "pixabay"
  license?: StorySceneAsset["license"]
}

export function StorySmartMashupPanel({
  brief,
  onChange,
}: {
  brief: StoryShoppingBrief
  onChange: Dispatch<SetStateAction<StoryShoppingBrief>>
}) {
  const story = brief.generatedStory
  const pool = brief.mediaPool || []
  const settings = {
    ...DEFAULT_STORY_MASHUP_SETTINGS,
    ...(brief.mashupSettings || {}),
  }
  const lineSlots = useMemo(
    () => (story ? buildStoryMashupLineSlots(story, brief.voiceData) : []),
    [brief.voiceData, story]
  )

  const [popupOpen, setPopupOpen] = useState(false)
  const [isFinding, setIsFinding] = useState(false)
  const [isCollecting, setIsCollecting] = useState(false)
  const [isMashing, setIsMashing] = useState(false)
  const [progress, setProgress] = useState("")
  const [error, setError] = useState("")
  const [keywords, setKeywords] = useState<string[]>([])
  const [candidates, setCandidates] = useState<CandidateVideo[]>([])
  const [previewId, setPreviewId] = useState<string | null>(null)
  /** 장바구니(다중 선택) — 아직 풀에 안 넣은 후보 */
  const [cartIds, setCartIds] = useState<string[]>([])
  const [situationKeyword, setSituationKeyword] = useState("")
  const [extraKeyword, setExtraKeyword] = useState("")

  const cartItems = useMemo(
    () => candidates.filter((item) => cartIds.includes(item.id)),
    [candidates, cartIds]
  )
  const previewItem = candidates.find((item) => item.id === previewId) || null

  const patchSettings = (patch: Partial<StoryMashupSettings>) => {
    onChange((current) => ({
      ...current,
      mashupSettings: {
        ...DEFAULT_STORY_MASHUP_SETTINGS,
        ...(current.mashupSettings || {}),
        ...patch,
      },
    }))
  }

  const addToPool = (items: StoryMediaPoolItem[]) => {
    onChange((current) => {
      const existing = current.mediaPool || []
      const keys = new Set(
        existing.flatMap((item) => [item.mediaUrl, item.pageUrl || ""].filter(Boolean))
      )
      const merged = [...existing]
      for (const item of items) {
        const key = item.mediaUrl || item.pageUrl || ""
        if (!key || keys.has(key)) continue
        keys.add(key)
        if (item.pageUrl) keys.add(item.pageUrl)
        merged.push(item)
      }
      return { ...current, mediaPool: merged }
    })
  }

  const removeFromPool = (id: string) => {
    onChange((current) => ({
      ...current,
      mediaPool: (current.mediaPool || []).filter((item) => item.id !== id),
    }))
  }

  const toggleCart = (id: string) => {
    setCartIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    )
  }

  const findRelatedVideos = async () => {
    if (!story) return
    if (
      !settings.includeGoogleLens &&
      !settings.includeGoogle &&
      !settings.includeStock &&
      !settings.includeYoutubeCc
    ) {
      setError("Google 렌즈 / Google / 스톡 / YouTube CC 중 하나 이상 체크해주세요.")
      return
    }
    const youtubeApiKey = getYoutubeKey()
    const serpKey = getSerpKey()
    const productImageUrl = resolveProductMainImage(brief)

    if (settings.includeYoutubeCc && !youtubeApiKey) {
      setError("설정에서 YouTube Data API Key를 저장해주세요.")
      return
    }
    if ((settings.includeGoogleLens || settings.includeGoogle) && !serpKey) {
      setError("Google 렌즈/검색을 위해 설정에서 SerpAPI 키를 저장해주세요.")
      return
    }
    if (settings.includeGoogleLens && !productImageUrl) {
      setError("쿠팡 제품 메인 사진이 없습니다. 제품 선택 단계를 다시 확인해 주세요.")
      return
    }

    setIsFinding(true)
    setError("")
    setCandidates([])
    setCartIds([])
    setPreviewId(null)
    setPopupOpen(true)
    const warnings: string[] = []
    try {
      const productQ = productSearchQuery(brief.productName, brief.productDescription)
      const fullScript = story.scenes.map((scene) => scene.narration).join(" ")
      const next: CandidateVideo[] = []
      const foundKeywords: string[] = []

      // 0) 쿠팡 메인 사진도 후보에 포함
      if (productImageUrl) {
        next.push({
          id: "product-main",
          title: `${brief.productName || "쿠팡 제품"} · 메인 사진`,
          thumbnailUrl: productImageUrl,
          pageUrl: brief.productUrl || productImageUrl,
          mediaUrl: productImageUrl,
          mediaType: "image",
          attribution: "Coupang",
          source: "google",
          license: "owned",
        })
        foundKeywords.push("쿠팡 메인 사진")
      }

      // 1순위: 제품 메인 사진 → Google Lens 유사 이미지
      if (settings.includeGoogleLens && productImageUrl) {
        setProgress("쿠팡 메인 사진으로 Google 렌즈 검색 중…")
        foundKeywords.push("Google Lens")
        try {
          const lensRes = await fetch("/api/shotform/story-shopping/asset-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source: "google_lens",
              imageUrl: productImageUrl,
              serpApiKey: serpKey,
            }),
          })
          const lensPayload = await lensRes.json()
          if (!lensRes.ok) throw new Error(lensPayload.error || "Google 렌즈 검색 실패")
          for (const item of lensPayload.items || []) {
            if (item.mediaUrl === productImageUrl) continue
            next.push({
              id: item.id,
              title: item.title,
              thumbnailUrl: item.thumbnailUrl,
              pageUrl: item.pageUrl,
              mediaUrl: item.mediaUrl,
              mediaType: "image",
              attribution: item.attribution,
              source: "google",
              license: "permission-confirmed",
            })
          }
        } catch (reason) {
          warnings.push(reason instanceof Error ? reason.message : "Google 렌즈 검색 실패")
        }
      }

      // 2순위(보조): 제품명 텍스트 Google 이미지·동영상
      if (settings.includeGoogle) {
        setProgress("제품명으로 Google 이미지·영상 보조 검색 중…")
        const googleQuery = [productQ, extraKeyword, situationKeyword]
          .filter(Boolean)
          .join(" ")
          .trim()
        foundKeywords.push(googleQuery)

        try {
          const imageRes = await fetch("/api/shotform/story-shopping/asset-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source: "google",
              query: googleQuery,
              serpApiKey: serpKey,
            }),
          })
          const imagePayload = await imageRes.json()
          if (!imageRes.ok) throw new Error(imagePayload.error || "Google 이미지 검색 실패")
          for (const item of imagePayload.items || []) {
            next.push({
              id: item.id,
              title: item.title,
              thumbnailUrl: item.thumbnailUrl,
              pageUrl: item.pageUrl,
              mediaUrl: item.mediaUrl,
              mediaType: "image",
              attribution: item.attribution,
              source: "google",
              license: "permission-confirmed",
            })
          }
        } catch (reason) {
          warnings.push(reason instanceof Error ? reason.message : "Google 이미지 검색 실패")
        }

        try {
          const videoRes = await fetch("/api/shotform/story-shopping/asset-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source: "google_videos",
              query: `${googleQuery} 사용 후기 OR review OR unboxing`,
              serpApiKey: serpKey,
            }),
          })
          const videoPayload = await videoRes.json()
          if (!videoRes.ok) throw new Error(videoPayload.error || "Google 동영상 검색 실패")
          for (const item of videoPayload.items || []) {
            next.push({
              id: item.id,
              title: item.title,
              thumbnailUrl: item.thumbnailUrl || "",
              pageUrl: item.pageUrl,
              mediaUrl: item.mediaUrl || "",
              mediaType: "video",
              durationSec: item.durationSec,
              attribution: item.attribution,
              source: "google",
              license: "permission-confirmed",
            })
          }
        } catch (reason) {
          warnings.push(reason instanceof Error ? reason.message : "Google 동영상 검색 실패")
        }
      }

      // 3순위: Pixabay — 제품명 기반 영문 키워드
      if (settings.includeStock) {
        setProgress("제품 관련 무료 스톡 영상 검색 중…")
        try {
          const pixabayKey = localStorage.getItem("shotform_pixabay_api_key") || undefined
          const openAiKey = localStorage.getItem("shotform_openai_api_key") || undefined
          let stockQuery = situationKeyword || productQ
          try {
            const suggestions = await generatePixabayKeywordSuggestions(
              `${productQ}. ${brief.productDescription || ""}`.slice(0, 180),
              brief.productName,
              openAiKey
            )
            stockQuery = suggestions[0]?.queryEn || stockQuery
          } catch {
            // keep stockQuery
          }
          foundKeywords.push(stockQuery)
          const result = await searchPixabayVideos(stockQuery, pixabayKey, { perPage: 12 })
          for (const item of result.hits.slice(0, 10)) {
            next.push({
              id: `pixabay-${item.id}`,
              title: item.tags || "Pixabay video",
              thumbnailUrl: item.previewURL,
              pageUrl: item.pageURL,
              mediaUrl: item.videoURL,
              mediaType: "video",
              durationSec: item.duration,
              attribution: item.user,
              source: "pixabay",
              license: "pixabay",
            })
          }
        } catch (reason) {
          warnings.push(reason instanceof Error ? reason.message : "스톡 영상 검색 실패")
        }
      }

      // 4순위(보조): YouTube CC
      if (settings.includeYoutubeCc) {
        setProgress("YouTube CC 보조 검색 중…")
        try {
          const context = [fullScript.slice(0, 200), productQ, situationKeyword]
            .filter(Boolean)
            .join(" · ")
          const params = new URLSearchParams({
            q: productQ,
            context,
            license: "cc",
            apiKey: youtubeApiKey,
          })
          const extras = [extraKeyword, situationKeyword].filter(Boolean).join(",")
          if (extras) params.set("keywords", extras)
          const response = await fetch(
            `/api/shotform/story-shopping/youtube-references?${params.toString()}`
          )
          const payload = await response.json()
          if (!response.ok) throw new Error(payload.error || "YouTube CC 검색 실패")
          foundKeywords.push(...(payload.keywords || []))
          for (const item of payload.items || []) {
            next.push({
              id: item.id,
              title: item.title,
              thumbnailUrl: item.thumbnailUrl,
              pageUrl: item.url,
              mediaUrl: "",
              mediaType: "video",
              durationSec: item.durationSec,
              attribution: item.channelTitle,
              source: "youtube",
              license: "youtube-cc",
            })
          }
        } catch (reason) {
          warnings.push(reason instanceof Error ? reason.message : "YouTube CC 검색 실패")
        }
      }

      setKeywords([...new Set(foundKeywords)].slice(0, 12))
      setCandidates(next)
      if (next[0]) setPreviewId(next[0].id)
      if (!next.length) {
        setError(warnings[0] || "관련 소재를 찾지 못했습니다. 제품명·키워드를 확인해 주세요.")
      } else if (warnings.length) {
        setError(warnings.join(" · "))
      }
      setProgress("")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "영상 검색에 실패했습니다.")
      setProgress("")
    } finally {
      setIsFinding(false)
    }
  }

  const resolveMediaUrl = async (item: CandidateVideo): Promise<string> => {
    if (item.mediaUrl) return item.mediaUrl
    if (item.source === "youtube" || (item.source === "google" && item.mediaType === "video")) {
      const response = await fetch("/api/shotform/mvp-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apifyApiKey: localStorage.getItem("shotform_apify_token") || undefined,
          items: [
            {
              url: item.pageUrl,
              platform: item.pageUrl.includes("youtube") ? "youtube" : "unknown",
              title: item.title,
            },
          ],
        }),
      })
      const payload = await response.json()
      const result = payload.results?.[0]
      if (!response.ok || !result?.downloadUrl) {
        throw new Error(result?.error || payload.error || `${item.title} 다운로드 실패`)
      }
      return String(result.downloadUrl)
    }
    throw new Error("재생 가능한 주소가 없습니다.")
  }

  const collectCartToPool = async () => {
    if (!cartItems.length) return
    if (!brief.assetRightsConfirmed && cartItems.some((item) => item.source !== "pixabay")) {
      setError("권리 확인 체크박스를 먼저 켜 주세요.")
      return
    }
    setIsCollecting(true)
    setError("")
    const added: StoryMediaPoolItem[] = []
    try {
      for (let index = 0; index < cartItems.length; index += 1) {
        const item = cartItems[index]!
        setProgress(`장바구니 담는 중… ${index + 1}/${cartItems.length}`)
        try {
          const mediaUrl = await resolveMediaUrl(item)
          added.push({
            id: makePoolId(item.source),
            mediaUrl,
            mediaType: item.mediaType,
            source: item.source === "google" ? "google" : item.source,
            title: item.title,
            thumbnailUrl: item.thumbnailUrl,
            durationSec: item.durationSec,
            pageUrl: item.pageUrl,
            attribution: item.attribution,
            license: item.license,
            addedAt: new Date().toISOString(),
          })
        } catch (reason) {
          warningsSafe(reason)
        }
      }
      if (added.length) addToPool(added)
      setCartIds([])
      setProgress(
        added.length
          ? `${added.length}개를 소재 풀에 담았습니다.`
          : "담기에 성공한 항목이 없습니다."
      )
    } finally {
      setIsCollecting(false)
    }
  }

  const warningsSafe = (reason: unknown) => {
    const message = reason instanceof Error ? reason.message : "담기 실패"
    setError((prev) => (prev ? `${prev} · ${message}` : message))
  }

  const runMashup = async () => {
    if (!story || !lineSlots.length) return
    setIsMashing(true)
    setError("")
    try {
      let workingPool = [...pool]

      if (settings.includeAi && workingPool.length < lineSlots.length) {
        setProgress("부족한 슬롯용 AI 이미지 생성 중…")
        const replicateKey = localStorage.getItem("shotform_replicate_api_key") || undefined
        if (!replicateKey) throw new Error("AI 보충을 위해 Replicate API 키가 필요합니다.")
        const need = Math.min(4, lineSlots.length - workingPool.length)
        for (let i = 0; i < need; i += 1) {
          const slot = lineSlots[i]!
          setProgress(`AI 이미지 ${i + 1}/${need} 생성 중…`)
          const imageUrl = await generateImageWithNanobanana(
            slot.text,
            brief.productName,
            brief.productImage,
            replicateKey,
            i,
            brief.productDescription,
            "9:16",
            "nano-banana"
          )
          workingPool.push({
            id: makePoolId("ai"),
            mediaUrl: imageUrl,
            mediaType: "image",
            source: "ai",
            title: `AI · ${slot.text.slice(0, 24)}`,
            license: "generated",
            addedAt: new Date().toISOString(),
          })
        }
        onChange((current) => ({ ...current, mediaPool: workingPool }))
      }

      if (!workingPool.length) {
        throw new Error("담아둔 소재가 없습니다. 먼저 관련 영상을 담아주세요.")
      }

      setProgress("AI가 대본 줄·시간에 맞게 컷 배치 중…")
      const response = await fetch("/api/shotform/story-shopping/mashup-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: brief.productName,
          productDescription: brief.productDescription,
          openaiApiKey: localStorage.getItem("shotform_openai_api_key") || undefined,
          lines: lineSlots.map((slot) => ({
            sceneId: slot.sceneId,
            lineIndex: slot.lineIndex,
            text: slot.text,
            visualPrompt: slot.visualPrompt,
            durationSec: slot.durationSec,
          })),
          pool: workingPool.map((item) => ({
            id: item.id,
            title: item.title,
            mediaType: item.mediaType,
            durationSec: item.durationSec,
            source: item.source,
          })),
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "배치에 실패했습니다.")

      const assignments = (payload.assignments || []) as Array<{
        sceneId: string
        lineIndex: number
        poolItemId: string
        trimStartSec: number
        trimEndSec: number
        reason: string
      }>

      const poolMap = new Map(workingPool.map((item) => [item.id, item]))
      const nextAssets: StorySceneAsset[] = []
      for (const assignment of assignments) {
        const poolItem = poolMap.get(assignment.poolItemId)
        if (!poolItem) continue
        nextAssets.push(
          poolItemToSceneAsset(poolItem, assignment.sceneId, assignment.lineIndex, {
            startSec: assignment.trimStartSec,
            endSec: assignment.trimEndSec,
          })
        )
      }

      onChange((current) => {
        const kept = (current.sceneAssets || []).filter(
          (asset) => !nextAssets.some((next) => isSameStoryAssetSlot(asset, next))
        )
        return {
          ...current,
          mediaPool: workingPool,
          sceneAssets: [...kept, ...nextAssets],
        }
      })
      setProgress(
        `완료 · ${nextAssets.length}개 줄을 대본 시간에 맞게 배치했습니다${
          payload.mode === "fallback" ? " (폴백)" : ""
        }.`
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "짜깁기에 실패했습니다.")
      setProgress("")
    } finally {
      setIsMashing(false)
    }
  }

  if (!story) {
    return (
      <div className="rounded-[28px] border border-dashed border-white/15 py-20 text-center text-zinc-400">
        스토리 대본을 먼저 생성해주세요.
      </div>
    )
  }

  const filledLines = lineSlots.filter((slot) =>
    brief.sceneAssets?.some(
      (asset) => asset.sceneId === slot.sceneId && (asset.lineIndex ?? 0) === slot.lineIndex
    )
  ).length

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-emerald-400/25 bg-gradient-to-br from-[#0b1210] to-[#0a0c0b] p-5">
        <div className="flex items-center gap-2 text-[9px] font-black tracking-[0.18em] text-emerald-300">
          <Wand2 className="h-4 w-4" />
          SMART MASHUP · 끝판왕 모드
        </div>
        <h2 className="mt-2 text-xl font-black text-white">
          제품 사진으로 렌즈 검색 → 담아서 AI 짜깁기
        </h2>
        <p className="mt-2 max-w-3xl text-xs leading-6 text-zinc-400">
          쿠팡에서 고른 제품의 <span className="text-emerald-200">메인 사진을 Google 렌즈</span>로
          돌려 비슷한 사진을 긁어옵니다. 쓸 것만 장바구니에 담은 뒤 AI가 대본 시간에 맞게
          짜깁기합니다.
        </p>

        {resolveProductMainImage(brief) ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 p-3">
            <img
              src={resolveProductMainImage(brief)}
              alt="제품 메인"
              className="h-16 w-16 rounded-xl object-cover"
            />
            <div className="min-w-0">
              <p className="text-[9px] font-black tracking-[0.14em] text-emerald-300">
                LENS SOURCE
              </p>
              <p className="mt-1 truncate text-xs font-bold text-white">
                {brief.productName || "선택한 쿠팡 제품"}
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-500">
                이 사진으로 Google 렌즈 유사 이미지를 검색합니다
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-100">
            제품 메인 사진이 없습니다. 앞 단계에서 쿠팡 제품을 다시 선택해 주세요.
          </p>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.07] p-3">
            <Checkbox
              checked={settings.includeGoogleLens}
              onCheckedChange={(checked) =>
                patchSettings({ includeGoogleLens: checked === true })
              }
            />
            <span className="text-[11px] leading-5 text-zinc-300">
              <span className="font-bold text-white">Google 렌즈 (추천)</span>
              <br />
              제품 메인 사진으로 유사 이미지
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-white/10 bg-black/25 p-3">
            <Checkbox
              checked={settings.includeGoogle}
              onCheckedChange={(checked) => patchSettings({ includeGoogle: checked === true })}
            />
            <span className="text-[11px] leading-5 text-zinc-300">
              <span className="font-bold text-white">제품명 Google</span>
              <br />
              텍스트 검색 보조
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-white/10 bg-black/25 p-3">
            <Checkbox
              checked={settings.includeStock}
              onCheckedChange={(checked) => patchSettings({ includeStock: checked === true })}
            />
            <span className="text-[11px] leading-5 text-zinc-300">
              <span className="font-bold text-white">무료 스톡</span>
              <br />
              Pixabay 영상 보충
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-white/10 bg-black/25 p-3">
            <Checkbox
              checked={settings.includeYoutubeCc}
              onCheckedChange={(checked) => patchSettings({ includeYoutubeCc: checked === true })}
            />
            <span className="text-[11px] leading-5 text-zinc-300">
              <span className="font-bold text-white">YouTube CC</span>
              <br />
              보조
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-white/10 bg-black/25 p-3">
            <Checkbox
              checked={settings.includeAi}
              onCheckedChange={(checked) => patchSettings({ includeAi: checked === true })}
            />
            <span className="text-[11px] leading-5 text-zinc-300">
              <span className="font-bold text-white">AI 보충</span>
              <br />
              부족하면 AI 이미지
            </span>
          </label>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2">
          <Input
            value={situationKeyword}
            onChange={(event) => setSituationKeyword(event.target.value)}
            placeholder="상황 키워드 (예: 주방 청소, pouring drink)"
            className="border-white/10 bg-black/30 text-white"
          />
          <Input
            value={extraKeyword}
            onChange={(event) => setExtraKeyword(event.target.value)}
            placeholder="추가 키워드 (선택)"
            className="border-white/10 bg-black/30 text-white"
          />
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
            외부 소재(Google·YouTube·스톡)의 라이선스·상업적 재사용을 확인했습니다.
          </span>
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() => void findRelatedVideos()}
            disabled={isFinding || isMashing}
            className="h-11 bg-emerald-600 font-black text-white hover:bg-emerald-500"
          >
            {isFinding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            1) 제품 사진으로 렌즈 검색
          </Button>
          <Button
            onClick={() => void runMashup()}
            disabled={isMashing || isFinding || pool.length === 0}
            className="h-11 bg-cyan-400 font-black text-black hover:bg-cyan-300"
          >
            {isMashing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Scissors className="mr-2 h-4 w-4" />
            )}
            2) AI가 대본 시간에 맞게 짜깁기
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-zinc-400">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
            대본 줄 {lineSlots.length}개
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
            담은 소재 {pool.length}개
          </span>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-200">
            배치 완료 {filledLines}/{lineSlots.length}
          </span>
        </div>

        {progress ? <p className="mt-3 text-xs text-cyan-200">{progress}</p> : null}
        {error ? (
          <p className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200">
            {error}
          </p>
        ) : null}
      </section>

      <section className="rounded-[24px] border border-white/10 bg-[#0d0d0c] p-4">
        <div className="mb-3 flex items-center gap-2 text-[9px] font-black tracking-[0.16em] text-zinc-500">
          <Film className="h-3.5 w-3.5" />
          담아둔 소재 풀
        </div>
        {pool.length === 0 ? (
          <p className="py-8 text-center text-xs text-zinc-500">
            아직 담은 소재가 없습니다. 위에서 「관련 소재 찾아서 담기」를 눌러주세요.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            {pool.map((item) => (
              <article
                key={item.id}
                className="overflow-hidden rounded-xl border border-white/10 bg-black"
              >
                {item.thumbnailUrl || item.mediaType === "image" ? (
                  <img
                    src={item.thumbnailUrl || item.mediaUrl}
                    alt={item.title}
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <video src={item.mediaUrl} muted className="aspect-video w-full object-cover" />
                )}
                <div className="p-2">
                  <p className="line-clamp-2 text-[9px] font-bold text-zinc-300">{item.title}</p>
                  <p className="mt-1 text-[8px] text-zinc-600">
                    {item.source}
                    {item.durationSec ? ` · ${Math.round(item.durationSec)}초` : ""}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeFromPool(item.id)}
                    className="mt-2 inline-flex items-center gap-1 text-[9px] text-red-300 hover:text-red-200"
                  >
                    <Trash2 className="h-3 w-3" />
                    제거
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <Dialog open={popupOpen} onOpenChange={setPopupOpen}>
        <DialogContent className="flex h-[min(92vh,900px)] w-[min(96vw,1440px)] !max-w-[min(96vw,1440px)] flex-col gap-0 overflow-hidden border-white/10 bg-[#0c0e10] p-0 text-zinc-100 sm:!max-w-[min(96vw,1440px)]">
          <DialogHeader className="shrink-0 border-b border-white/10 px-6 py-4 pr-12 text-left">
            <DialogTitle className="flex items-center gap-2 text-base font-black">
              <Clapperboard className="h-5 w-5 text-emerald-300" />
              관련 소재 골라 담기
            </DialogTitle>
            <DialogDescription className="text-[11px] leading-5 text-zinc-400">
              썸네일을 눌러 <span className="text-emerald-200">여러 개 선택(장바구니)</span>한 뒤 아래
              「장바구니 담기」를 누르세요. 미리보기는 카드의 「보기」로 확인합니다.
            </DialogDescription>
            {keywords.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] text-emerald-100"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            ) : null}
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">
            {isFinding ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-zinc-400">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-300" />
                제품 관련 소재 수집 중…
              </div>
            ) : candidates.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-zinc-500">
                결과가 없습니다.
              </p>
            ) : (
              <div className="grid h-full gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                <div className="hidden min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-black lg:block">
                  {previewItem?.mediaType === "image" ? (
                    <img
                      src={previewItem.mediaUrl || previewItem.thumbnailUrl}
                      alt={previewItem.title}
                      className="h-full w-full object-contain bg-black"
                    />
                  ) : previewItem?.source === "pixabay" && previewItem.mediaUrl ? (
                    <video
                      src={previewItem.mediaUrl}
                      controls
                      className="h-full w-full object-contain"
                    />
                  ) : previewItem?.source === "youtube" ? (
                    <iframe
                      title="preview"
                      src={`https://www.youtube.com/embed/${previewItem.id}?rel=0`}
                      className="h-full w-full"
                      allowFullScreen
                    />
                  ) : previewItem?.pageUrl ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 bg-zinc-950 p-4 text-center">
                      <img
                        src={previewItem.thumbnailUrl}
                        alt=""
                        className="max-h-[60%] max-w-full rounded-lg object-contain"
                      />
                      <p className="line-clamp-2 text-[11px] text-zinc-300">{previewItem.title}</p>
                      <a
                        href={previewItem.pageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-emerald-300"
                      >
                        <ExternalLink className="h-3 w-3" />
                        원본에서 미리보기
                      </a>
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-center text-xs text-zinc-500">
                      「보기」를 누르면 미리보기가 나옵니다.
                    </div>
                  )}
                </div>

                <div className="grid min-h-0 grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                  {candidates.map((item) => {
                    const inCart = cartIds.includes(item.id)
                    const already = pool.some(
                      (entry) =>
                        entry.pageUrl === item.pageUrl ||
                        (item.mediaUrl && entry.mediaUrl === item.mediaUrl)
                    )
                    const previewing = previewId === item.id
                    return (
                      <div
                        key={item.id}
                        className={`min-w-0 overflow-hidden rounded-xl border ${
                          inCart
                            ? "border-emerald-400/60 bg-emerald-500/10"
                            : previewing
                              ? "border-cyan-400/40 bg-cyan-500/5"
                              : "border-white/10"
                        }`}
                      >
                        <button
                          type="button"
                          className="relative w-full text-left"
                          onClick={() => toggleCart(item.id)}
                        >
                          <div className="aspect-video w-full overflow-hidden bg-zinc-900">
                            <img
                              src={item.thumbnailUrl}
                              alt={item.title}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <span
                            className={`absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-md border ${
                              inCart
                                ? "border-emerald-300 bg-emerald-500 text-black"
                                : "border-white/40 bg-black/50 text-transparent"
                            }`}
                          >
                            <Check className="h-3 w-3" />
                          </span>
                          {already ? (
                            <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[8px] text-zinc-300">
                              풀에 있음
                            </span>
                          ) : null}
                          <div className="p-2">
                            <p className="line-clamp-2 text-[10px] font-bold text-zinc-200">
                              {item.title}
                            </p>
                            <p className="mt-1 text-[8px] text-zinc-500">
                              {item.source} · {item.mediaType}
                              {item.durationSec ? ` · ${Math.round(item.durationSec)}초` : ""}
                            </p>
                          </div>
                        </button>
                        <div className="flex gap-1 border-t border-white/5 p-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewId(item.id)}
                            className="inline-flex h-7 flex-1 items-center justify-center rounded-md border border-white/10 text-[9px] text-zinc-300"
                          >
                            보기
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleCart(item.id)}
                            className={`inline-flex h-7 flex-1 items-center justify-center rounded-md text-[9px] font-black ${
                              inCart
                                ? "bg-emerald-500 text-black"
                                : "border border-emerald-400/30 text-emerald-200"
                            }`}
                          >
                            {inCart ? "선택됨" : "선택"}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 장바구니 바 */}
          <div className="shrink-0 border-t border-white/10 bg-[#0a0c0e] px-6 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
                <ShoppingCart className="h-4 w-4 shrink-0 text-emerald-300" />
                <span className="shrink-0 text-[11px] font-bold text-zinc-300">
                  장바구니 {cartIds.length}개
                </span>
                {cartItems.slice(0, 10).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleCart(item.id)}
                    className="relative h-10 w-14 shrink-0 overflow-hidden rounded-md border border-emerald-400/30"
                    title="클릭하면 선택 해제"
                  >
                    <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
                {cartIds.length === 0 ? (
                  <span className="text-[10px] text-zinc-500">
                    썸네일을 눌러 여러 개 담으세요
                  </span>
                ) : null}
              </div>
              <Button
                onClick={() => void collectCartToPool()}
                disabled={isCollecting || cartIds.length === 0}
                className="h-10 bg-emerald-500 font-black text-black hover:bg-emerald-300"
              >
                {isCollecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShoppingCart className="mr-2 h-4 w-4" />
                )}
                장바구니 담기 ({cartIds.length})
              </Button>
              <Button
                onClick={() => setPopupOpen(false)}
                variant="outline"
                className="h-10 border-white/15 bg-white/[0.04] text-zinc-200"
              >
                닫기 · 풀 {pool.length}개
              </Button>
            </div>
            {isCollecting || progress ? (
              <p className="mt-2 text-[10px] text-cyan-200">{progress}</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

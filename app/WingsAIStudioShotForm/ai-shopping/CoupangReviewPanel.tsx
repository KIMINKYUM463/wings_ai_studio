"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ClipboardPaste, Download, Loader2, PlugZap } from "lucide-react"
import {
  connectLocalAgent,
  downloadLocalAgentStarter,
  fetchCoupangIngestedOnCompanion,
  probeLocalCompanion,
} from "@/lib/shotform-local-companion-client"
import {
  coupangStatusMessage,
  normalizeCoupangReviews,
  type CoupangCollectResult,
} from "@/lib/shotform-coupang-reviews"
import type { ProductReviewItem } from "./project-actions"

export type CoupangCollectedProduct = {
  productName: string
  /** AI가 고른 제품 컷 (최대 2장) */
  images?: string[]
  productImages?: string[]
  detailImages?: string[]
  productImage?: string
  /** 상품평 첨부 사진 */
  reviewImages?: string[]
  reviews: ProductReviewItem[]
  /** 갤러리 후보 전체 (디버그·재선정용) */
  productImageCandidates?: string[]
  photoPickNote?: string
}

type Props = {
  onApplyCollected: (data: CoupangCollectedProduct) => void
  /** 스토리 쇼핑용: 리뷰 사진을 AI 선별·개수 제한 없이 전부 유지 */
  includeAllReviewImages?: boolean
}

function getOpenAiKey(): string {
  if (typeof window === "undefined") return ""
  return (localStorage.getItem("shotform_openai_api_key") || "").trim()
}

function slimReviews(
  reviews: ProductReviewItem[] | undefined,
  productName?: string,
  includeAllReviewImages = false
): ProductReviewItem[] {
  return normalizeCoupangReviews(reviews, productName, {
    maxImagesPerReview: includeAllReviewImages ? null : 8,
  })
    .map((r) => ({
      content: (r.content || "").trim(),
      page: r.page,
      indexOnPage: r.indexOnPage,
      images: Array.isArray(r.images)
        ? includeAllReviewImages
          ? r.images.filter(
              (u) => typeof u === "string" && /^https?:\/\//i.test(u)
            )
          : r.images
              .filter((u) => typeof u === "string" && /^https?:\/\//i.test(u))
              .slice(0, 8)
        : undefined,
    }))
    .filter((r) => r.content.length >= 2)
}

function uniqHttp(urls: unknown): string[] {
  if (!Array.isArray(urls)) return []
  return Array.from(
    new Set(urls.filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u)))
  )
}

/** 수집기에서 전송된 상품·상세·리뷰 불러오기 */
export function CoupangReviewPanel({
  onApplyCollected,
  includeAllReviewImages = false,
}: Props) {
  const [statusMsg, setStatusMsg] = useState("")
  const [isPull, setIsPull] = useState(false)
  const [isConnect, setIsConnect] = useState(false)
  const [isPasteApply, setIsPasteApply] = useState(false)
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null)
  const [jsonPaste, setJsonPaste] = useState("")

  /** 수집기 JSON / 에이전트 응답 → 제품·리뷰 적용 (공통) */
  const applyCollectedResult = async (
    result: CoupangCollectResult & {
      productImages?: string[]
      reviewImages?: string[]
      message?: string
    }
  ) => {
    const name = (result.productName || "").trim()
    const cleaned = slimReviews(result.reviews || [], name, includeAllReviewImages)
    const details = uniqHttp(result.detailImages)
    const candidates = uniqHttp(result.productImages || result.images)
    const allReviewImages = uniqHttp([
      ...(result.reviewImages || []),
      ...cleaned.flatMap((r) => r.images || []),
    ])
    const reviewImages = includeAllReviewImages
      ? allReviewImages
      : allReviewImages.slice(0, 40)
    const openAiKey = getOpenAiKey()

    if (
      !name &&
      cleaned.length === 0 &&
      details.length === 0 &&
      candidates.length === 0 &&
      reviewImages.length === 0
    ) {
      setStatusMsg(
        result.message ||
          coupangStatusMessage((result.status as "no_reviews") || "no_reviews") ||
          "데이터가 비어 있습니다. 수집기 JSON을 확인하세요."
      )
      return
    }

    let productImages = candidates.slice(0, 2)
    let productImage = productImages[0] || ""
    let photoPickNote = ""

    if (candidates.length > 0) {
      if (openAiKey && candidates.length > 1) {
        setStatusMsg(
          `갤러리 ${candidates.length}장 중 제품이 잘 보이는 컷을 AI가 고르는 중…`
        )
        try {
          const res = await fetch("/api/shotform/coupang/pick-product-photos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              openaiApiKey: openAiKey,
              productName: name,
              imageUrls: candidates.slice(0, 12),
              maxPick: 2,
            }),
          })
          const json = (await res.json().catch(() => ({}))) as {
            productImages?: string[]
            productImage?: string
            aiPicked?: boolean
            note?: string
            error?: string
          }
          if (res.ok && Array.isArray(json.productImages) && json.productImages.length) {
            productImages = uniqHttp(json.productImages).slice(0, 2)
            productImage = json.productImage || productImages[0] || ""
            photoPickNote = json.note || (json.aiPicked ? "AI 선정" : "")
          } else if (json.error) {
            photoPickNote = `AI 선정 실패 → 수집 순서 사용 (${json.error})`
          }
        } catch {
          photoPickNote = "AI 선정 실패 → 수집 순서 사용"
        }
      } else if (!openAiKey) {
        photoPickNote =
          "OpenAI 키가 없어 수집 순서로 1·2번을 사용합니다. (설정에서 키 입력 시 AI 선정)"
      }
    }

    let selectedReviewImages = reviewImages
    let reviewPhotoPickNote = ""
    if (includeAllReviewImages && reviewImages.length) {
      reviewPhotoPickNote = `리뷰 사진 ${reviewImages.length}장을 필터 없이 모두 불러왔습니다.`
    } else if (reviewImages.length && openAiKey) {
      setStatusMsg(
        `리뷰 사진 ${reviewImages.length}장 중 제품이 크고 선명한 사진만 AI가 선별하는 중…`
      )
      try {
        const res = await fetch("/api/shotform/coupang/pick-product-photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            openaiApiKey: openAiKey,
            productName: name,
            imageUrls: reviewImages.slice(0, 20),
            maxPick: 12,
            onlyClearlyVisible: true,
          }),
        })
        const json = (await res.json().catch(() => ({}))) as {
          productImages?: string[]
          note?: string
          error?: string
        }
        if (res.ok && Array.isArray(json.productImages)) {
          selectedReviewImages = uniqHttp(json.productImages).slice(0, 12)
          reviewPhotoPickNote =
            json.note ||
            `리뷰 사진 ${reviewImages.length}장 중 제품이 잘 보이는 ${selectedReviewImages.length}장만 선정`
        } else {
          selectedReviewImages = reviewImages.slice(0, 12)
          reviewPhotoPickNote = `리뷰 사진 AI 선별 실패 → 원본 후보 유지 (${json.error || "응답 오류"})`
        }
      } catch {
        selectedReviewImages = reviewImages.slice(0, 12)
        reviewPhotoPickNote = "리뷰 사진 AI 선별 실패 → 원본 후보 유지"
      }
    } else if (reviewImages.length && !openAiKey) {
      reviewPhotoPickNote =
        "OpenAI 키가 없어 리뷰 사진의 제품 노출 여부를 선별하지 못했습니다."
    }

    const selectedReviewSet = new Set(selectedReviewImages)
    const reviewsWithSelectedImages = cleaned.map((review) => {
      const images = (review.images || []).filter((url) => selectedReviewSet.has(url))
      return { ...review, images: images.length ? images : undefined }
    })

    onApplyCollected({
      productName: name,
      images: productImages.length ? productImages : undefined,
      productImages: productImages.length ? productImages : undefined,
      detailImages: details.length ? details : undefined,
      productImage: productImage || undefined,
      reviewImages: selectedReviewImages.length ? selectedReviewImages : undefined,
      reviews: reviewsWithSelectedImages,
      productImageCandidates: candidates.length ? candidates : undefined,
      photoPickNote: photoPickNote || undefined,
    })

    const bits = [
      name ? "상품명" : null,
      candidates.length > productImages.length
        ? `제품사진 AI선정 ${productImages.length}장 (후보 ${candidates.length})`
        : productImages.length
          ? `제품사진 ${productImages.length}장`
          : null,
      details.length ? `상세 ${details.length}장` : null,
      selectedReviewImages.length
        ? includeAllReviewImages
          ? `리뷰사진 전체 ${selectedReviewImages.length}장`
          : `리뷰사진 AI선정 ${selectedReviewImages.length}장 (후보 ${reviewImages.length})`
        : reviewImages.length
          ? `리뷰사진 후보 ${reviewImages.length}장 · 선정 0장`
          : null,
      cleaned.length ? `리뷰 ${cleaned.length}개` : null,
    ].filter(Boolean)
    setStatusMsg(
      [
        bits.length ? `${bits.join(" · ")}을(를) 불러왔습니다.` : "데이터를 불러왔습니다.",
        photoPickNote,
        reviewPhotoPickNote,
      ]
        .filter(Boolean)
        .join("\n")
    )
  }

  /** 로컬/배포: 터미널·프로토콜·원클릭 .cmd 순으로 기동 후 연결 */
  const handleConnectAgent = async () => {
    setIsConnect(true)
    setStatusMsg("")
    try {
      const health = await connectLocalAgent({
        requireFfmpeg: false,
        onProgress: (m) => setStatusMsg(m),
      })
      setAgentOnline(Boolean(health.ok))
      if (health.ok) {
        setStatusMsg(
          "로컬 에이전트 연결됨 (http://127.0.0.1:3847)\n검은 창은 끄지 마세요. 확장에서 수집·전송한 뒤 「전송된 리뷰 불러오기」를 누르세요."
        )
      } else {
        setStatusMsg(
          health.error ||
            "연결 실패. 「실행파일 받기」로 start-shotform-agent.cmd 를 받아 더블클릭한 뒤 다시 연결하세요."
        )
      }
    } finally {
      setIsConnect(false)
    }
  }

  const handlePullIngested = async () => {
    setIsPull(true)
    setStatusMsg("")
    try {
      const result = await fetchCoupangIngestedOnCompanion({
        onProgress: (m) => setStatusMsg(m),
      })
      await applyCollectedResult(result)
    } finally {
      setIsPull(false)
    }
  }

  /** 확장 「JSON 클립보드 복사」 → 붙여넣기 (에이전트 불필요) */
  const handleApplyPastedJson = async () => {
    const raw = jsonPaste.trim()
    if (!raw) {
      setStatusMsg("수집기에서 「JSON 클립보드 복사」한 내용을 아래에 붙여넣으세요.")
      return
    }
    setIsPasteApply(true)
    setStatusMsg("")
    try {
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        setStatusMsg("JSON 형식이 아닙니다. 클립보드 전체를 다시 복사해 붙여넣으세요.")
        return
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setStatusMsg("수집기 JSON 객체(상품명·리뷰 등)가 아닙니다.")
        return
      }
      const obj = parsed as Record<string, unknown>
      // 에이전트가 { data: {...} } 로 감싼 경우
      const payload =
        obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)
          ? (obj.data as Record<string, unknown>)
          : obj

      await applyCollectedResult({
        status: "ok",
        productName: String(payload.productName || ""),
        images: Array.isArray(payload.images) ? (payload.images as string[]) : undefined,
        productImages: Array.isArray(payload.productImages)
          ? (payload.productImages as string[])
          : undefined,
        detailImages: Array.isArray(payload.detailImages)
          ? (payload.detailImages as string[])
          : undefined,
        productImage:
          typeof payload.productImage === "string" ? payload.productImage : undefined,
        reviewImages: Array.isArray(payload.reviewImages)
          ? (payload.reviewImages as string[])
          : undefined,
        reviews: Array.isArray(payload.reviews)
          ? (payload.reviews as ProductReviewItem[])
          : [],
      })
      setJsonPaste("")
    } finally {
      setIsPasteApply(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-orange-400/25 bg-orange-500/5 p-4">
      <div className="space-y-1">
        <Label className="text-sm font-semibold text-zinc-200">Wings 숏폼 쿠팡 수집기</Label>
        <p className="text-xs text-zinc-500 leading-relaxed">
          「에이전트 연결」을 누르면 수집기 확장이{" "}
          <span className="text-orange-200/80">.cmd를 받아 자동으로 실행</span>
          합니다. (확장 v1.2+ · chrome://extensions 에서 새로고침)
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isConnect || isPull || isPasteApply}
          onClick={() => void handleConnectAgent()}
          className="font-semibold"
          data-shotform-launch-agent="1"
          data-shotform-cmd-url="/api/shotform/local-agent/download?file=cmd"
        >
          {isConnect ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <PlugZap className="w-3.5 h-3.5 mr-1.5" />
          )}
          {agentOnline ? "에이전트 다시 연결" : isConnect ? "연결·실행파일 준비 중…" : "에이전트 연결"}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isPull || isConnect || isPasteApply}
          onClick={() => void handlePullIngested()}
          className="bg-orange-500 hover:bg-orange-400 text-white"
        >
          {isPull ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5 mr-1.5" />
          )}
          전송된 리뷰 불러오기
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isConnect}
          className="text-xs text-amber-200/80"
          onClick={() => {
            downloadLocalAgentStarter()
            setStatusMsg(
              "start-shotform-agent.cmd 를 받았습니다. 다운로드 폴더에서 더블클릭하세요. (Node.js LTS 필요)"
            )
          }}
        >
          실행파일 받기
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isConnect}
          className="text-xs text-zinc-400"
          onClick={() => {
            void probeLocalCompanion().then((h) => {
              setAgentOnline(Boolean(h.ok))
              setStatusMsg(
                h.ok
                  ? "에이전트 응답 OK · http://127.0.0.1:3847"
                  : h.error || "에이전트가 꺼져 있습니다. 「실행파일 받기」를 사용하세요."
              )
            })
          }}
        >
          상태 확인
        </Button>
      </div>

      <div className="space-y-2 rounded-lg border border-white/10 bg-black/25 p-3">
        <Label className="text-xs font-semibold text-zinc-300">
          에이전트 없이 · JSON 붙여넣기
        </Label>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          수집기 → 「JSON 클립보드 복사」 → 여기에 붙여넣기 → 「JSON 적용」
        </p>
        <Textarea
          value={jsonPaste}
          onChange={(e) => setJsonPaste(e.target.value)}
          placeholder='{"productName":"...","reviews":[...],"detailImages":[...]}'
          className="min-h-[120px] resize-y border-white/10 bg-zinc-950/80 font-mono text-[11px] text-zinc-200"
          disabled={isPasteApply || isPull}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isPasteApply || isPull || !jsonPaste.trim()}
            onClick={() => void handleApplyPastedJson()}
            className="font-semibold"
          >
            {isPasteApply ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <ClipboardPaste className="w-3.5 h-3.5 mr-1.5" />
            )}
            JSON 적용
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPasteApply || !jsonPaste}
            className="text-xs text-zinc-400"
            onClick={() => setJsonPaste("")}
          >
            지우기
          </Button>
        </div>
      </div>

      {statusMsg ? (
        <p className="text-xs text-orange-200/90 leading-relaxed whitespace-pre-line">{statusMsg}</p>
      ) : (
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          에이전트가 되면 「전송된 리뷰 불러오기」, 안 되면 JSON 붙여넣기를 사용하세요.
        </p>
      )}
    </div>
  )
}

/** 붙여넣은 텍스트 → 리뷰 배열 (빈 줄/번호 줄 기준) */
export function parsePastedReviews(raw: string): ProductReviewItem[] {
  const text = String(raw || "").replace(/\r\n/g, "\n").trim()
  if (!text) return []

  // 이중 개행으로 먼저 분리, 없으면 한 줄씩
  let chunks = text
    .split(/\n\s*\n+/)
    .map((s) => s.trim())
    .filter(Boolean)

  if (chunks.length <= 1) {
    chunks = text
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length >= 4)
  }

  // "1.", "1)", "1페이지 · 1번" 같은 접두 제거
  const cleaned = chunks
    .map((s) =>
      s
        .replace(/^\d+\s*페이지\s*[·.]\s*\d+\s*번\s*/i, "")
        .replace(/^\d+[\).]\s*/, "")
        .replace(/^[-*•]\s*/, "")
        .trim()
    )
    .filter((s) => s.length >= 4)

  return cleaned.map((content, i) => ({
    content,
    page: Math.floor(i / 5) + 1,
    indexOnPage: (i % 5) + 1,
  }))
}

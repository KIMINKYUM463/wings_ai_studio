"use client"

import { useState, type ReactNode } from "react"
import { Database, Expand, Images, MessageSquareText, Sparkles } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  CoupangReviewPanel,
  type CoupangCollectedProduct,
} from "../ai-shopping/CoupangReviewPanel"
import { CollectBriefingPanel } from "../ai-shopping/CollectAiInsightPanels"
import type {
  CoupangReviewInsightsData,
  ProductReviewItem,
} from "../ai-shopping/project-actions"
import type { CoupangDetailInsights } from "@/lib/shotform-coupang-detail-insights"
import type { StoryShoppingBrief } from "./story-types"

export function StoryProductCollectorPanel({
  brief,
  onChange,
}: {
  brief: StoryShoppingBrief
  onChange: (brief: StoryShoppingBrief) => void
}) {
  const collector = brief.collectorData
  const [detailInsights, setDetailInsights] = useState<CoupangDetailInsights | null>(
    (collector?.detailInsights as CoupangDetailInsights | undefined) || null
  )
  const [reviewInsights, setReviewInsights] = useState<CoupangReviewInsightsData | null>(
    (collector?.reviewInsights as CoupangReviewInsightsData | undefined) || null
  )
  const [openDetail, setOpenDetail] = useState<"images" | "review-images" | "reviews" | null>(null)

  const applyCollected = (data: CoupangCollectedProduct) => {
    const productImages = data.productImages || data.images || []
    const reviewImages = Array.from(
      new Set([
        ...(data.reviewImages || []),
        ...(data.reviews || []).flatMap((r) => r.images || []),
      ].filter((u) => typeof u === "string" && /^https?:\/\//i.test(u)))
    )
    onChange({
      ...brief,
      productImage: brief.productImage || data.productImage || productImages[0] || "",
      collectorData: {
        collectedProductName: data.productName,
        productImages,
        detailImages: data.detailImages || [],
        reviewImages,
        reviews: data.reviews || [],
        photoPickNote: data.photoPickNote || "",
        detailInsights: undefined,
        reviewInsights: undefined,
        collectedAt: new Date().toISOString(),
      },
      storyTemplateRecommendation: undefined,
      generatedStory: undefined,
      voiceData: undefined,
      sceneAssets: undefined,
    })
    setDetailInsights(null)
    setReviewInsights(null)
  }

  const updateDetailInsights = (value: CoupangDetailInsights | null) => {
    setDetailInsights(value)
    if (!brief.collectorData) return
    onChange({
      ...brief,
      collectorData: { ...brief.collectorData, detailInsights: value || undefined },
    })
  }

  const updateReviewInsights = (value: CoupangReviewInsightsData | null) => {
    setReviewInsights(value)
    if (!brief.collectorData) return
    onChange({
      ...brief,
      collectorData: { ...brief.collectorData, reviewInsights: value || undefined },
    })
  }

  return (
    <section className="mt-5 overflow-hidden rounded-[26px] border border-cyan-400/15 bg-gradient-to-br from-cyan-500/[0.06] via-[#10100f] to-orange-500/[0.04]">
      <div className="border-b border-white/10 p-5 md:p-6">
        <div className="flex items-center gap-2 text-[9px] font-black tracking-[0.18em] text-cyan-300">
          <Database className="h-4 w-4" />
          PRODUCT STORY COLLECTOR
        </div>
        <h3 className="mt-2 text-xl font-black text-white">제품 수집기로 대본 근거를 모으세요.</h3>
        <p className="mt-2 text-xs leading-6 text-zinc-300">
          AI 쇼핑 숏폼과 동일한 수집기로 상세 이미지와 실제 리뷰를 가져와 다음 단계의
          스토리 대본에 반영합니다.
        </p>
      </div>

      <div className="p-5 md:p-6">
        <CoupangReviewPanel
          onApplyCollected={applyCollected}
          includeAllReviewImages
        />

        {collector ? (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                icon={<Images className="h-4 w-4" />}
                label="제품 상세 이미지"
                value={`${collector.productImages.length + collector.detailImages.length}장`}
                onClick={() => setOpenDetail("images")}
              />
              <SummaryCard
                icon={<Images className="h-4 w-4 text-emerald-300" />}
                label="리뷰 사진"
                value={`${(collector.reviewImages || []).length}장`}
                onClick={() => setOpenDetail("review-images")}
              />
              <SummaryCard
                icon={<MessageSquareText className="h-4 w-4" />}
                label="수집 리뷰"
                value={`${collector.reviews.length}개`}
                onClick={() => setOpenDetail("reviews")}
              />
              <SummaryCard
                icon={<Sparkles className="h-4 w-4" />}
                label="AI 분석"
                value={
                  collector.detailInsights || collector.reviewInsights ? "분석 완료" : "분석 대기"
                }
              />
            </div>

            <Dialog
              open={openDetail !== null}
              onOpenChange={(open) => {
                if (!open) setOpenDetail(null)
              }}
            >
              <DialogContent className="max-h-[88vh] max-w-5xl overflow-hidden border-white/10 bg-[#0b0d0e] p-0 text-white">
                <DialogHeader className="border-b border-white/10 px-6 py-5 text-left">
                  <div className="pr-8">
                    <div>
                      <DialogTitle className="flex items-center gap-2 text-lg font-black">
                        {openDetail === "reviews" ? (
                          <MessageSquareText className="h-5 w-5 text-cyan-300" />
                        ) : (
                          <Images className="h-5 w-5 text-cyan-300" />
                        )}
                        {openDetail === "images"
                          ? "제품 상세 이미지"
                          : openDetail === "review-images"
                            ? "리뷰 첨부 사진"
                            : "수집 리뷰"}
                      </DialogTitle>
                      <DialogDescription className="mt-2 text-xs text-zinc-400">
                        {openDetail === "images"
                          ? `수집된 제품·상세 이미지 ${
                              collector.productImages.length + collector.detailImages.length
                            }장을 확인할 수 있습니다.`
                          : openDetail === "review-images"
                            ? `쿠팡 상품평에 첨부된 사진 ${(collector.reviewImages || []).length}장입니다. 영상 편집 단계에서 Nano Banana로 변형할 수 있습니다.`
                            : `쿠팡 상품 페이지에서 수집한 실제 리뷰 ${collector.reviews.length}개입니다.`}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="max-h-[calc(88vh-100px)] overflow-y-auto p-5 md:p-6">
                  {openDetail === "images" || openDetail === "review-images" ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {(openDetail === "review-images"
                        ? collector.reviewImages || []
                        : [...collector.productImages, ...collector.detailImages]
                      ).map((imageUrl, index) => (
                          <a
                            key={`${imageUrl}-${index}`}
                            href={imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 transition hover:border-cyan-300/50"
                          >
                            <img
                              src={imageUrl}
                              alt={
                                openDetail === "review-images"
                                  ? `리뷰 사진 ${index + 1}`
                                  : `제품 상세 이미지 ${index + 1}`
                              }
                              className="max-h-[520px] w-full object-contain"
                            />
                            <span className="absolute left-2 top-2 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-black text-white">
                              {index + 1}
                            </span>
                            <span className="absolute bottom-2 right-2 rounded-lg bg-cyan-400 p-2 text-black opacity-0 shadow-lg transition group-hover:opacity-100">
                              <Expand className="h-4 w-4" />
                            </span>
                          </a>
                        ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {collector.reviews.map((review, index) => (
                        <article
                          key={`${review.page || 0}-${review.indexOnPage || index}-${index}`}
                          className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-cyan-500/15 px-2 text-[10px] font-black text-cyan-200">
                              {index + 1}
                            </span>
                            {review.page ? (
                              <span className="text-[9px] text-zinc-500">
                                수집 페이지 {review.page}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-zinc-200">
                            {review.content}
                          </p>
                          {review.images?.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {review.images.map((url, imgIndex) => (
                                <a
                                  key={`${url}-${imgIndex}`}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block h-16 w-16 overflow-hidden rounded-lg border border-white/10"
                                >
                                  <img
                                    src={url}
                                    alt={`리뷰 ${index + 1} 사진 ${imgIndex + 1}`}
                                    className="h-full w-full object-cover"
                                  />
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <div className="mt-5">
              <CollectBriefingPanel
                productName={brief.productName || collector.collectedProductName}
                detailImages={collector.detailImages}
                productImage={brief.productImage || collector.productImages[0] || null}
                reviews={collector.reviews as ProductReviewItem[]}
                detailInsights={detailInsights}
                reviewInsights={reviewInsights}
                onDetailInsights={updateDetailInsights}
                onReviewInsights={updateReviewInsights}
              />
            </div>
          </>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 py-10 text-center text-xs text-zinc-400">
            쿠팡 확장 프로그램에서 상품을 수집한 뒤 위 버튼으로 불러오세요.
          </div>
        )}
      </div>
    </section>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  onClick,
}: {
  icon: ReactNode
  label: string
  value: string
  onClick?: () => void
}) {
  const content = (
    <>
      <div className="flex items-center gap-2 text-cyan-300">
        {icon}
        <span className="text-[9px] font-bold text-zinc-400">{label}</span>
      </div>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
      {onClick ? (
        <p className="mt-2 flex items-center gap-1 text-[9px] font-bold text-cyan-300/80">
          <Expand className="h-3 w-3" />
          클릭해서 전체 보기
        </p>
      ) : null}
    </>
  )

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-white/10 bg-black/25 p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-cyan-500/[0.06]"
    >
      {content}
    </button>
  ) : (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">{content}</div>
  )
}

"use client"

import { useEffect, useState } from "react"
import {
  Check,
  ExternalLink,
  Loader2,
  PackageSearch,
  Rocket,
  Search,
  ShoppingBag,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { CoupangRankedProduct } from "@/lib/shotform-keyword-analysis-types"

function productImageSrc(url: string) {
  if (!url) return url
  if (url.startsWith("data:")) return url
  if (url.startsWith("http")) {
    return `/api/shotform/image-proxy?url=${encodeURIComponent(url)}`
  }
  return url
}

export function AnimalCoupangSearchPanel({
  characterName,
  searchQuery,
  products,
  selectedProductId,
  isSearching,
  searchError,
  onSearchQueryChange,
  onSearch,
  onSelectProduct,
}: {
  characterName: string
  searchQuery: string
  products: CoupangRankedProduct[]
  selectedProductId: string | null
  isSearching: boolean
  searchError: string
  onSearchQueryChange: (query: string) => void
  onSearch: (query: string) => void
  onSelectProduct: (product: CoupangRankedProduct) => void
}) {
  const [localQuery, setLocalQuery] = useState(searchQuery)

  useEffect(() => {
    setLocalQuery(searchQuery)
  }, [searchQuery])

  const handleSearch = () => {
    const normalized = localQuery.trim()
    if (!normalized) return
    onSearchQueryChange(normalized)
    onSearch(normalized)
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[rgba(125,211,168,0.25)] bg-[#7dd3a8]/5 p-4 md:p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-[#7dd3a8]/30 bg-[#7dd3a8]/15 p-2">
          <PackageSearch className="h-5 w-5 text-[#7dd3a8]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="animal-bubble-chip inline-flex px-2.5 py-1 text-[10px]">COUPANG</p>
          <h3 className="animal-display mt-2 text-lg font-bold text-[#fff6ee]">
            쿠팡에서 제품 찾기
          </h3>
          <p className="mt-1 text-sm leading-6 text-[#9aa89c]">
            검색어 하나로{" "}
            <span className="font-semibold text-[#ff8fab]">{characterName}</span>
            이(가) 쿠팡에서 고를 수 있는 인기 상품을 골라보세요.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch()
          }}
          placeholder="예: 간식 자동급식기, 고양이 간식, 츄르"
          className="h-11 flex-1 border-[rgba(243,235,224,0.12)] bg-black/35 text-[#f3ebe0] placeholder:text-[#6b7a6e]"
        />
        <Button
          type="button"
          onClick={handleSearch}
          disabled={isSearching || !localQuery.trim()}
          className="animal-mint-btn h-11 shrink-0 rounded-full px-5 font-semibold"
        >
          {isSearching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              검색 중…
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              쿠팡 검색
            </>
          )}
        </Button>
      </div>

      {searchError ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {searchError}
        </p>
      ) : null}

      {products.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[#d7e0d8]">
            검색 결과 · 상품을 누르면 {characterName}이(가) 그 제품을 활용하는 장면 레퍼런스로 쓰입니다 (동물·제품 외형 유지)
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products.slice(0, 9).map((product) => {
              const selected = selectedProductId === product.productId
              return (
                <article
                  key={product.productId}
                  className={`overflow-hidden rounded-2xl border transition ${
                    selected
                      ? "border-[#ff8fab]/50 bg-[#ff8fab]/10 shadow-lg shadow-[#ff8fab]/10"
                      : "border-[rgba(255,246,238,0.1)] bg-black/25 hover:border-[#7dd3a8]/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectProduct(product)}
                    className="w-full text-left"
                  >
                    <div className="relative aspect-square bg-white/95">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={productImageSrc(product.productImage)}
                        alt={product.productName}
                        className="h-full w-full object-contain p-3"
                      />
                      {selected ? (
                        <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#ff8fab] text-white shadow-md">
                          <Check className="h-4 w-4" />
                        </span>
                      ) : null}
                      {product.isRocket ? (
                        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#7dd3a8] px-2 py-0.5 text-[10px] font-bold text-[#0d1a14]">
                          <Rocket className="h-3 w-3" />
                          로켓
                        </span>
                      ) : null}
                    </div>
                    <div className="space-y-1.5 p-3">
                      <p className="line-clamp-2 text-xs font-semibold text-[#f3ebe0]">
                        {product.productName}
                      </p>
                      <p className="text-sm font-bold text-[#7dd3a8]">
                        {product.productPrice.toLocaleString("ko-KR")}원
                      </p>
                    </div>
                  </button>
                  <div className="border-t border-[rgba(255,246,238,0.06)] px-3 pb-3">
                    <a
                      href={product.productUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-[#6b7a6e] hover:text-[#9aa89c]"
                    >
                      쿠팡에서 보기 <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      ) : !isSearching && !searchError ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[rgba(125,211,168,0.2)] bg-black/20 px-4 py-8 text-center">
          <ShoppingBag className="h-8 w-8 text-[#7dd3a8]/60" />
          <p className="text-sm text-[#9aa89c]">키워드를 입력하고 쿠팡 검색을 눌러보세요</p>
          <p className="text-xs text-[#6b7a6e]">
            <Sparkles className="mr-1 inline h-3 w-3" />
            인기 상품이 여기에 표시됩니다
          </p>
        </div>
      ) : null}
    </div>
  )
}

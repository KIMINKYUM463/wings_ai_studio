"use client"

import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  ShoppingLinkBlock,
  ShoppingLinkDesign,
  ShoppingLinkProfile,
} from "@/lib/shotform-shopping-link-types"
import { SHOPPING_LINK_THEMES } from "@/lib/shotform-shopping-link-types"
import { sortShoppingLinkBlocks } from "@/lib/shotform-shopping-link-store"

type Props = {
  profile: ShoppingLinkProfile
  blocks: ShoppingLinkBlock[]
  design: ShoppingLinkDesign
  className?: string
  interactive?: boolean
  /** 공개 링크 페이지: 큰 폰 프레임, '실시간 미리보기' 문구 숨김 */
  variant?: "embed" | "standalone"
}

function resolveTheme(design: ShoppingLinkDesign) {
  const preset = SHOPPING_LINK_THEMES[design.theme]
  const bg =
    design.backgroundType === "image" && design.backgroundImageUrl
      ? undefined
      : design.backgroundColor || preset.bg
  const text = design.autoTextColor ? preset.text : design.textColor
  return { preset, bg, text }
}

function fontSizeClass(size: ShoppingLinkProfile["profileFontSize"] | ShoppingLinkDesign["textSize"]) {
  if (size === "small") return "text-xs"
  if (size === "large") return "text-base"
  return "text-sm"
}

function cardClass(style: ShoppingLinkDesign["cardStyle"]) {
  if (style === "rounded") return "rounded-2xl"
  if (style === "outline") return "rounded-xl border-2 border-current/15 bg-transparent"
  if (style === "fill") return "rounded-xl bg-current/10"
  return "rounded-xl border border-black/5 bg-white/90 shadow-sm"
}

export function ShoppingLinkLivePreview({
  profile,
  blocks,
  design,
  className,
  interactive = false,
  variant = "embed",
}: Props) {
  const isStandalone = variant === "standalone"
  const { preset, bg, text } = resolveTheme(design)
  const visibleBlocks = sortShoppingLinkBlocks(blocks).filter((b) => b.enabled && b.title.trim())
  const initial = profile.displayName.trim().charAt(0).toUpperCase() || "?"

  const frameOn = design.phoneFrameEnabled !== false
  const phoneStyle: React.CSSProperties = frameOn
    ? { backgroundColor: design.phoneBorderColor || "#ffffff" }
    : {}

  const screenStyle: React.CSSProperties = {
    backgroundColor: bg,
    backgroundImage:
      design.backgroundType === "image" && design.backgroundImageUrl
        ? `url(${design.backgroundImageUrl})`
        : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
    color: text,
    fontFamily: design.fontFamily === "Pretendard" ? "var(--font-pretendard, Pretendard, sans-serif)" : design.fontFamily,
  }

  return (
    <div className={cn("flex flex-col items-center", className)}>
      {!isStandalone ? (
        <p className="mb-3 text-center text-sm font-medium text-slate-300">실시간 미리보기</p>
      ) : null}
      <div
        className={cn(
          frameOn ? "shadow-2xl shadow-black/40" : "",
          frameOn
            ? isStandalone
              ? "rounded-[2.5rem] p-4 sm:rounded-[2.75rem] sm:p-5"
              : "rounded-[2rem] p-3"
            : "rounded-[1.6rem] p-0"
        )}
        style={frameOn ? phoneStyle : undefined}
      >
        <div
          className="relative flex h-[560px] w-[280px] flex-col overflow-hidden rounded-[1.6rem] border border-black/5"
          style={screenStyle}
        >
          {design.topNoticeEnabled && design.topNoticeText.trim() ? (
            <div
              className="relative shrink-0 overflow-hidden py-1.5"
              style={{ backgroundColor: design.topNoticeBackgroundColor || "#38bdf8" }}
            >
              <div className="shopping-link-notice-marquee-track">
                <span className="inline-block whitespace-nowrap px-8 text-[10px] font-medium leading-none text-white">
                  {design.topNoticeText.trim()}
                </span>
                <span aria-hidden className="inline-block whitespace-nowrap px-8 text-[10px] font-medium leading-none text-white">
                  {design.topNoticeText.trim()}
                </span>
              </div>
            </div>
          ) : null}

          {design.bannerImageUrl ? (
            <div className="relative h-24 w-full shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={design.bannerImageUrl} alt="" className="h-full w-full object-cover" />
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto px-4 py-5">
            {profile.layout !== "basic" && profile.coverImageUrl ? (
              <div className="relative mb-4 h-24 w-full overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={profile.coverImageUrl} alt="" className="h-full w-full object-cover" />
              </div>
            ) : null}

            <div className={cn("mb-5 flex flex-col gap-2", profile.alignment === "center" ? "items-center text-center" : "items-start text-left")}>
              {profile.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.profileImageUrl}
                  alt=""
                  className="h-16 w-16 rounded-full border-2 border-white/80 object-cover shadow"
                />
              ) : (
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white shadow"
                  style={{ background: `linear-gradient(135deg, ${preset.accent}, #fb923c)` }}
                >
                  {initial}
                </div>
              )}
              <div>
                <p className={cn("font-bold", profile.profileFontSize === "large" ? "text-lg" : profile.profileFontSize === "small" ? "text-sm" : "text-base")}>
                  {profile.displayName.trim() || "제목"}
                </p>
                {profile.bio.trim() ? (
                  <p className={cn("mt-1 opacity-75", fontSizeClass(profile.profileFontSize))}>{profile.bio}</p>
                ) : null}
              </div>
            </div>

            {design.searchBarEnabled ? (
              <div className="mb-4 flex items-center gap-2 rounded-full border border-current/10 bg-white/50 px-3 py-2 text-xs opacity-80">
                <Search className="h-3.5 w-3.5 shrink-0" />
                <span>상품 검색</span>
              </div>
            ) : null}

            <div className="space-y-3">
              {visibleBlocks.map((block) => (
                <a
                  key={block.id}
                  href={interactive && block.type === "link" && block.url ? block.url : undefined}
                  target={interactive ? "_blank" : undefined}
                  rel={interactive ? "noopener noreferrer" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 p-3 transition hover:opacity-90",
                    cardClass(design.cardStyle),
                    !interactive || block.type !== "link" || !block.url ? "pointer-events-none" : ""
                  )}
                  onClick={(e) => {
                    if (!interactive) e.preventDefault()
                  }}
                >
                  {block.type === "link" ? (
                    block.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={block.thumbnailUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="h-12 w-12 shrink-0 rounded-lg bg-black/10" />
                    )
                  ) : null}
                  <span className={cn("line-clamp-2 flex-1 font-medium", fontSizeClass(design.textSize))}>{block.title}</span>
                </a>
              ))}
            </div>

            {design.businessEmail.trim() ? (
              <button
                type="button"
                className="mt-4 w-full rounded-full border border-current/15 py-2 text-xs font-medium opacity-80"
              >
                비즈니스 제안
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

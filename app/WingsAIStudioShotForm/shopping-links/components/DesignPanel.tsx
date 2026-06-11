"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { ShoppingLinkDesign } from "@/lib/shotform-shopping-link-types"
import {
  SHOPPING_LINK_BG_SWATCHES,
  SHOPPING_LINK_TEXT_COLOR_SWATCHES,
  SHOPPING_LINK_THEMES,
  SHOPPING_LINK_TOP_NOTICE_BG_SWATCHES,
} from "@/lib/shotform-shopping-link-types"
import { readImageFileAsDataUrl } from "@/lib/shotform-shopping-link-store"

type Props = {
  design: ShoppingLinkDesign
  onChange: (design: ShoppingLinkDesign) => void
  onSave: () => Promise<void>
  saving?: boolean
  message?: string | null
}

export function DesignPanel({ design, onChange, onSave, saving, message }: Props) {
  const bannerRef = useRef<HTMLInputElement>(null)
  const patch = (partial: Partial<ShoppingLinkDesign>) => onChange({ ...design, ...partial })

  const uploadBanner = async (file: File | undefined) => {
    if (!file) return
    try {
      const dataUrl = await readImageFileAsDataUrl(file)
      patch({ bannerImageUrl: dataUrl })
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-slate-300">테마</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(SHOPPING_LINK_THEMES) as Array<keyof typeof SHOPPING_LINK_THEMES>).map((key) => {
            const theme = SHOPPING_LINK_THEMES[key]
            return (
              <button
                key={key}
                type="button"
                onClick={() => patch({ theme: key, backgroundColor: theme.bg, backgroundType: "color", backgroundImageUrl: null })}
                className={cn(
                  "rounded-xl border p-3 text-left text-xs transition",
                  design.theme === key ? "border-pink-500 ring-1 ring-pink-500/40" : "border-slate-700"
                )}
              >
                <div className="mb-2 h-8 rounded-md border border-black/5" style={{ background: theme.bg }} />
                <span className="font-medium text-slate-200">{theme.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-800 p-4">
        <div className="flex items-center justify-between">
          <Label className="text-slate-300">상단 한줄</Label>
          <Switch checked={design.topNoticeEnabled} onCheckedChange={(v) => patch({ topNoticeEnabled: v })} />
        </div>
        <Textarea
          value={design.topNoticeText}
          onChange={(e) => patch({ topNoticeText: e.target.value })}
          rows={2}
          className="border-slate-700 bg-slate-950 text-white"
        />
        <div className="space-y-2 pt-1">
          <Label className="text-slate-400">공지 배경색</Label>
          <div className="flex flex-wrap gap-2">
            {SHOPPING_LINK_TOP_NOTICE_BG_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => patch({ topNoticeBackgroundColor: color })}
                className={cn(
                  "h-8 w-8 rounded-full border-2",
                  design.topNoticeBackgroundColor === color ? "border-pink-400" : "border-transparent"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">배경</Label>
        <div className="flex gap-2">
          {(["color", "image"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => patch({ backgroundType: type })}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm",
                design.backgroundType === type ? "border-pink-500 text-pink-200" : "border-slate-700 text-slate-400"
              )}
            >
              {type === "color" ? "컬러" : "이미지"}
            </button>
          ))}
        </div>
      </div>

      {design.backgroundType === "color" ? (
        <div className="space-y-2">
          <Label className="text-slate-300">배경색</Label>
          <div className="flex flex-wrap gap-2">
            {SHOPPING_LINK_BG_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() =>
                  patch({
                    backgroundType: "color",
                    backgroundColor: color,
                    backgroundImageUrl: null,
                  })
                }
                className={cn(
                  "h-8 w-8 rounded-full border-2",
                  design.backgroundColor === color && design.backgroundType === "color"
                    ? "border-pink-400"
                    : "border-transparent"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <Label className="text-slate-300">배경 이미지 URL</Label>
          <Input
            value={design.backgroundImageUrl ?? ""}
            onChange={(e) => patch({ backgroundImageUrl: e.target.value || null })}
            className="border-slate-700 bg-slate-950 text-white"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-slate-300">배너 업로드</Label>
        <button
          type="button"
          onClick={() => bannerRef.current?.click()}
          className="flex w-full items-center justify-center rounded-xl border border-dashed border-slate-600 py-8 text-sm text-slate-500 hover:border-slate-500"
        >
          {design.bannerImageUrl ? "배너 이미지 변경" : "배너 업로드"}
        </button>
        <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={(e) => void uploadBanner(e.target.files?.[0])} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-slate-800 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-200">테두리</p>
            <p className="text-xs text-slate-500">폰 프레임(베젤) 표시</p>
          </div>
          <Switch
            checked={design.phoneFrameEnabled !== false}
            onCheckedChange={(v) => patch({ phoneFrameEnabled: v })}
          />
        </div>
        {design.phoneFrameEnabled !== false ? (
          <div className="flex flex-wrap gap-2">
            {["#ffffff", "#0f172a", "#f472b6", "#dbeafe"].map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => patch({ phoneBorderColor: color })}
                className={cn(
                  "h-8 w-8 rounded-full border-2",
                  design.phoneBorderColor === color ? "border-pink-400" : "border-slate-600"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">카드 스타일</Label>
        <div className="flex flex-wrap gap-2">
          {([
            ["default", "기본"],
            ["rounded", "둥근"],
            ["outline", "아웃라인"],
            ["fill", "채우기"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => patch({ cardStyle: value })}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm",
                design.cardStyle === value ? "border-pink-500 text-pink-200" : "border-slate-700 text-slate-400"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-800 px-4 py-3">
        <div>
          <p className="text-sm text-slate-200">글씨 색상 자동</p>
          <p className="text-xs text-slate-500">배경에 맞춰 글씨색 조정</p>
        </div>
        <Switch checked={design.autoTextColor} onCheckedChange={(v) => patch({ autoTextColor: v })} />
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">글씨 색상</Label>
        <div className="flex flex-wrap items-center gap-2">
          {SHOPPING_LINK_TEXT_COLOR_SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => patch({ autoTextColor: false, textColor: color })}
              className={cn(
                "h-8 w-8 rounded-full border-2",
                !design.autoTextColor && design.textColor === color ? "border-pink-400" : "border-slate-600"
              )}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-800 px-4 py-3">
        <p className="text-sm text-slate-200">검색창</p>
        <Switch checked={design.searchBarEnabled} onCheckedChange={(v) => patch({ searchBarEnabled: v })} />
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">글씨 크기</Label>
        <div className="flex gap-2">
          {(["small", "medium", "large"] as const).map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => patch({ textSize: size })}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm",
                design.textSize === size ? "border-pink-500 text-pink-200" : "border-slate-700 text-slate-400"
              )}
            >
              {size === "small" ? "작게" : size === "large" ? "크게" : "보통"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">비즈니스 제안 이메일</Label>
        <Input
          value={design.businessEmail}
          onChange={(e) => patch({ businessEmail: e.target.value })}
          placeholder="contact@example.com"
          className="border-slate-700 bg-slate-950 text-white"
        />
      </div>

      {message ? <p className="text-sm text-emerald-400">{message}</p> : null}

      <Button
        type="button"
        disabled={saving}
        className="w-full bg-gradient-to-r from-pink-500 to-violet-500"
        onClick={() => void onSave()}
      >
        {saving ? "저장 중…" : "디자인 저장"}
      </Button>
    </div>
  )
}

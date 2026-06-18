"use client"

import { useRef, useState } from "react"
import { ArrowLeft, Instagram, Youtube } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { ShoppingLinkBlock, ShoppingLinkDesign, ShoppingLinkProfile } from "@/lib/shotform-shopping-link-types"
import { readImageFileAsDataUrl } from "@/lib/shotform-shopping-link-store"
import { ShoppingLinkLivePreview } from "./ShoppingLinkLivePreview"
import { ShoppingLinkSlugField } from "./ShoppingLinkUrlBar"

type Props = {
  profile: ShoppingLinkProfile
  blocks: ShoppingLinkBlock[]
  design: ShoppingLinkDesign
  onChange: (profile: ShoppingLinkProfile) => void
  onSave: (profile: ShoppingLinkProfile) => Promise<void>
  onBack?: () => void
  saving?: boolean
  message?: string | null
  messageVariant?: "success" | "error"
  isFirstSetup?: boolean
}

const LAYOUTS = [
  { id: "basic" as const, label: "기본형" },
  { id: "cover-text" as const, label: "커버+텍스트" },
  { id: "cover-profile" as const, label: "커버+프로필" },
  { id: "cover-emphasis" as const, label: "커버 강조형" },
]

export function ProfileSettingsForm({
  profile,
  blocks,
  design,
  onChange,
  onSave,
  onBack,
  saving,
  message,
  messageVariant = "success",
  isFirstSetup,
}: Props) {
  const profileInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [localMsg, setLocalMsg] = useState<string | null>(null)

  const patch = (partial: Partial<ShoppingLinkProfile>) => onChange({ ...profile, ...partial })

  const uploadImage = async (file: File | undefined, field: "profileImageUrl" | "coverImageUrl") => {
    if (!file) return
    try {
      const dataUrl = await readImageFileAsDataUrl(file)
      patch({ [field]: dataUrl })
    } catch (e) {
      setLocalMsg(e instanceof Error ? e.message : "업로드 실패")
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <div className="mb-6 flex items-center gap-3">
          {!isFirstSetup && onBack ? (
            <button type="button" onClick={onBack} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : null}
          <div>
            <h1 className="text-xl font-bold text-white">프로필 설정</h1>
            {isFirstSetup ? (
              <p className="mt-1 text-sm text-slate-400">인포크링크처럼 프로필과 주소를 먼저 설정하세요.</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="relative h-20 w-20 overflow-hidden rounded-full border-2 border-dashed border-slate-600 bg-slate-800"
              onClick={() => profileInputRef.current?.click()}
            >
              {profile.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.profileImageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-slate-500">프로필</span>
              )}
            </button>
            <div>
              <p className="text-sm font-medium text-slate-200">프로필 이미지</p>
              <p className="text-xs text-slate-500">클릭하여 변경 (최대 5MB)</p>
            </div>
            <input ref={profileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void uploadImage(e.target.files?.[0], "profileImageUrl")} />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">제목 *</Label>
            <Input value={profile.displayName} onChange={(e) => patch({ displayName: e.target.value })} className="border-slate-700 bg-slate-950 text-white" />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">내용</Label>
            <Textarea value={profile.bio} onChange={(e) => patch({ bio: e.target.value })} rows={3} className="border-slate-700 bg-slate-950 text-white" />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">프로필 레이아웃</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {LAYOUTS.map((layout) => (
                <button
                  key={layout.id}
                  type="button"
                  onClick={() => patch({ layout: layout.id })}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-xs font-medium transition",
                    profile.layout === layout.id
                      ? "border-pink-500 bg-pink-500/10 text-pink-200"
                      : "border-slate-700 text-slate-400 hover:border-slate-600"
                  )}
                >
                  {layout.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            className="flex w-full items-center justify-center rounded-xl border border-dashed border-slate-600 py-8 text-sm text-slate-500 hover:border-slate-500 hover:text-slate-300"
          >
            {profile.coverImageUrl ? "커버 이미지 변경" : "클릭하여 커버 이미지 업로드"}
          </button>
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void uploadImage(e.target.files?.[0], "coverImageUrl")} />

          <div className="space-y-2">
            <Label className="text-slate-300">정렬</Label>
            <div className="flex gap-2">
              {(["left", "center"] as const).map((align) => (
                <button
                  key={align}
                  type="button"
                  onClick={() => patch({ alignment: align })}
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm",
                    profile.alignment === align ? "border-pink-500 text-pink-200" : "border-slate-700 text-slate-400"
                  )}
                >
                  {align === "left" ? "왼쪽 정렬" : "가운데 정렬"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">프로필 글씨 크기</Label>
            <div className="flex gap-2">
              {([
                ["small", "작게"],
                ["medium", "보통"],
                ["large", "크게"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => patch({ profileFontSize: value })}
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm",
                    profile.profileFontSize === value ? "border-pink-500 text-pink-200" : "border-slate-700 text-slate-400"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-slate-400">
                <Youtube className="h-3.5 w-3.5" /> YouTube
              </Label>
              <Input value={profile.snsYoutube} onChange={(e) => patch({ snsYoutube: e.target.value })} placeholder="https://" className="border-slate-700 bg-slate-950 text-white" />
            </div>
            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-slate-400">
                <Instagram className="h-3.5 w-3.5" /> Instagram
              </Label>
              <Input value={profile.snsInstagram} onChange={(e) => patch({ snsInstagram: e.target.value })} placeholder="https://" className="border-slate-700 bg-slate-950 text-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-400">TikTok</Label>
              <Input value={profile.snsTiktok} onChange={(e) => patch({ snsTiktok: e.target.value })} placeholder="https://" className="border-slate-700 bg-slate-950 text-white" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">쿠팡 파트너스 ID (선택)</Label>
            <Input value={profile.coupangPartnerId} onChange={(e) => patch({ coupangPartnerId: e.target.value })} placeholder="AF1234567" className="border-slate-700 bg-slate-950 text-white" />
          </div>

          {message || localMsg ? (
            <p
              className={cn(
                "text-sm",
                messageVariant === "error" || localMsg ? "text-red-400" : "text-emerald-400"
              )}
            >
              {message ?? localMsg}
            </p>
          ) : null}

          <Button
            type="button"
            disabled={saving || !profile.slug || !profile.displayName.trim()}
            className="w-full bg-gradient-to-r from-pink-500 to-violet-500 text-white hover:from-pink-600 hover:to-violet-600"
            onClick={() => void onSave(profile)}
          >
            {saving ? "저장 중…" : "프로필 저장"}
          </Button>
        </div>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <ShoppingLinkLivePreview profile={profile} blocks={blocks} design={design} />
        <ShoppingLinkSlugField
          className="mx-auto mt-6 w-full max-w-[280px] rounded-xl border border-slate-800 bg-slate-900/60 p-4"
          slug={profile.slug}
          onChange={(slug) => patch({ slug })}
          label="URL"
          required
          inputId="profile-settings-slug"
        />
      </div>
    </div>
  )
}

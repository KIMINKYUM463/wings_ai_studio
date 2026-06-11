"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ShoppingLinkPageData } from "@/lib/shotform-shopping-link-types"
import {
  createEmptyShoppingLinkDraft,
  fetchShoppingLinkPage,
  loadShoppingLinkDraft,
  patchShoppingLinkDraft,
  publishShoppingLinkPage,
  saveShoppingLinkDraft,
} from "@/lib/shotform-shopping-link-store"
import { BlockListPanel } from "./components/BlockListPanel"
import { DesignPanel } from "./components/DesignPanel"
import { ProfileSettingsForm } from "./components/ProfileSettingsForm"
import { ShoppingLinkLivePreview } from "./components/ShoppingLinkLivePreview"
import { ShoppingLinkUrlBar } from "./components/ShoppingLinkUrlBar"

type Tab = "blocks" | "design"

export function ShoppingLinksView() {
  const [data, setData] = useState<ShoppingLinkPageData>(() => createEmptyShoppingLinkDraft())
  const [loaded, setLoaded] = useState(false)
  const [tab, setTab] = useState<Tab>("blocks")
  const [showProfileSettings, setShowProfileSettings] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageVariant, setMessageVariant] = useState<"success" | "error">("success")

  const hasProfile = Boolean(data.profile.slug.trim() && data.profile.displayName.trim())

  const statsLine = useMemo(() => {
    const links = data.blocks.filter((b) => b.type === "link" && b.enabled).length
    const texts = data.blocks.filter((b) => b.type === "text" && b.enabled).length
    return `상품 ${links}개 · 텍스트 ${texts}개`
  }, [data.blocks])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const draft = loadShoppingLinkDraft()
      if (draft?.profile.slug) {
        try {
          const published = await fetchShoppingLinkPage(draft.profile.slug)
          if (!cancelled && published) {
            setData(published)
            setShowProfileSettings(false)
            setLoaded(true)
            return
          }
        } catch {
          /* fallback to draft */
        }
      }
      if (!cancelled) {
        setData(draft ?? createEmptyShoppingLinkDraft())
        setShowProfileSettings(!(draft?.profile.slug && draft.profile.displayName))
        setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const updateData = useCallback((next: ShoppingLinkPageData) => {
    setData(next)
    saveShoppingLinkDraft(next)
  }, [])

  const flash = (text: string, variant: "success" | "error" = "success") => {
    setMessage(text)
    setMessageVariant(variant)
    window.setTimeout(() => setMessage(null), variant === "error" ? 5000 : 2500)
  }

  const publish = async (next: ShoppingLinkPageData) => {
    setSaving(true)
    try {
      await publishShoppingLinkPage(next)
      setData(next)
      flash("저장되었습니다!", "success")
      setShowProfileSettings(false)
    } catch (e) {
      flash(e instanceof Error ? e.message : "저장 실패", "error")
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) {
    return <div className="h-40 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/40" />
  }

  if (!hasProfile || showProfileSettings) {
    return (
      <ProfileSettingsForm
        profile={data.profile}
        blocks={data.blocks}
        design={data.design}
        isFirstSetup={!hasProfile}
        saving={saving}
        message={message}
        messageVariant={messageVariant}
        onBack={hasProfile ? () => setShowProfileSettings(false) : undefined}
        onChange={(profile) => updateData(patchShoppingLinkDraft(data, { profile }))}
        onSave={async () => publish(patchShoppingLinkDraft(data, { profile: data.profile }))}
      />
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{data.profile.displayName}</h1>
          <p className="mt-1 text-sm text-slate-400">{statsLine}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowProfileSettings(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:border-slate-600"
        >
          <Settings className="h-4 w-4" />
          프로필 설정
        </button>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="mb-6 flex gap-2 border-b border-slate-800">
            {([
              ["blocks", "블록 리스트"],
              ["design", "디자인"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "border-b-2 px-4 py-3 text-sm font-medium transition",
                  tab === id ? "border-violet-400 text-violet-200" : "border-transparent text-slate-500 hover:text-slate-300"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "blocks" ? (
            <BlockListPanel
              blocks={data.blocks}
              saving={saving}
              message={message}
              onChange={(blocks) => updateData(patchShoppingLinkDraft(data, { blocks }))}
              onSave={async () => publish(data)}
            />
          ) : (
            <DesignPanel
              design={data.design}
              saving={saving}
              message={message}
              onChange={(design) => updateData(patchShoppingLinkDraft(data, { design }))}
              onSave={async () => publish(data)}
            />
          )}
        </div>

        <div className="xl:sticky xl:top-6 xl:self-start">
          <ShoppingLinkLivePreview profile={data.profile} blocks={data.blocks} design={data.design} />
          <ShoppingLinkUrlBar slug={data.profile.slug} />
        </div>
      </div>
    </div>
  )
}

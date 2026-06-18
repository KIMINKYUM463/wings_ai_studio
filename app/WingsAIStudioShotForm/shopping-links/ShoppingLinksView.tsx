"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ShoppingLinkPageData } from "@/lib/shotform-shopping-link-types"
import { sanitizeShoppingLinkSlug } from "@/lib/shotform-shopping-link-types"
import {
  createEmptyShoppingLinkDraft,
  fetchShoppingLinkPage,
  loadShoppingLinkDraft,
  mergeShoppingLinkPageData,
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
  const [serverData, setServerData] = useState<ShoppingLinkPageData | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [tab, setTab] = useState<Tab>("blocks")
  const [showProfileSettings, setShowProfileSettings] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageVariant, setMessageVariant] = useState<"success" | "error">("success")
  const dataRef = useRef(data)
  dataRef.current = data

  const hasProfile = Boolean(data.profile.slug.trim() && data.profile.displayName.trim())

  const statsLine = useMemo(() => {
    const links = data.blocks.filter((b) => b.type === "link" && b.enabled).length
    const texts = data.blocks.filter((b) => b.type === "text" && b.enabled).length
    return `상품 ${links}개 · 텍스트 ${texts}개`
  }, [data.blocks])

  const hasUnpublishedChanges = useMemo(() => {
    if (!serverData) return false
    const slug = sanitizeShoppingLinkSlug(data.profile.slug)
    if (!slug) return false
    return (
      JSON.stringify(data.blocks) !== JSON.stringify(serverData.blocks) ||
      data.profile.displayName !== serverData.profile.displayName ||
      data.profile.bio !== serverData.profile.bio ||
      JSON.stringify(data.design) !== JSON.stringify(serverData.design)
    )
  }, [data, serverData])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const draft = loadShoppingLinkDraft() ?? createEmptyShoppingLinkDraft()
      const slug = sanitizeShoppingLinkSlug(draft.profile.slug)
      let merged = draft
      let published: ShoppingLinkPageData | null = null

      if (slug) {
        try {
          published = await fetchShoppingLinkPage(slug)
          if (published) merged = mergeShoppingLinkPageData(draft, published)
        } catch {
          /* 서버 조회 실패 시 로컬 draft 유지 */
        }
      }

      if (!cancelled) {
        setData(merged)
        setServerData(published)
        saveShoppingLinkDraft(merged)
        setShowProfileSettings(!(merged.profile.slug && merged.profile.displayName))
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

  const publish = async (next?: ShoppingLinkPageData) => {
    const payload = next ?? dataRef.current
    setSaving(true)
    try {
      const saved = await publishShoppingLinkPage(payload)
      setData(saved)
      setServerData(saved)
      saveShoppingLinkDraft(saved)
      flash(
        `공개 페이지에 반영되었습니다! (블록 ${saved.blocks.length}개 · ${saved.profile.displayName})`,
        "success"
      )
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
        key={showProfileSettings ? "profile-open" : "profile-setup"}
        profile={data.profile}
        blocks={data.blocks}
        design={data.design}
        isFirstSetup={!hasProfile}
        saving={saving}
        message={message}
        messageVariant={messageVariant}
        onBack={hasProfile ? () => setShowProfileSettings(false) : undefined}
        onChange={(profile) => updateData(patchShoppingLinkDraft(dataRef.current, { profile }))}
        onSave={async (profile) => publish(patchShoppingLinkDraft(dataRef.current, { profile }))}
      />
    )
  }

  return (
    <div>
      {hasUnpublishedChanges ? (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          미리보기와 공개 URL이 다릅니다. 아래 「블록 저장 · 페이지에 반영」 또는 「프로필 저장」을 눌러야{" "}
          <span className="font-medium text-amber-100">wingsaistudio.com</span> 공개 페이지에 반영됩니다.
        </div>
      ) : null}
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
              messageVariant={messageVariant}
              onChange={(blocks) => updateData(patchShoppingLinkDraft(dataRef.current, { blocks }))}
              onSave={async (blocks) =>
                publish(
                  patchShoppingLinkDraft(dataRef.current, {
                    blocks: blocks.map((b, i) => ({ ...b, order: i })),
                  })
                )
              }
            />
          ) : (
            <DesignPanel
              design={data.design}
              saving={saving}
              message={message}
              onChange={(design) => updateData(patchShoppingLinkDraft(dataRef.current, { design }))}
              onSave={async () => publish(patchShoppingLinkDraft(dataRef.current, { design: dataRef.current.design }))}
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

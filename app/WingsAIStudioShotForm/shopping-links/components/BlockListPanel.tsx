"use client"

import { useState } from "react"
import { GripVertical, Pencil, Pin, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { studio } from "../../components/ShotFormStudioUI"
import type { ShoppingLinkBlock } from "@/lib/shotform-shopping-link-types"
import { newShoppingLinkBlock, sortShoppingLinkBlocks } from "@/lib/shotform-shopping-link-store"

type Props = {
  blocks: ShoppingLinkBlock[]
  onChange: (blocks: ShoppingLinkBlock[]) => void
  onSave: () => Promise<void>
  saving?: boolean
  message?: string | null
}

export function BlockListPanel({ blocks, onChange, onSave, saving, message }: Props) {
  const [subTab, setSubTab] = useState<"link" | "text">("link")
  const [draft, setDraft] = useState({ url: "", thumbnailUrl: "", title: "" })
  const [editingId, setEditingId] = useState<string | null>(null)

  const sorted = sortShoppingLinkBlocks(blocks)

  const resetDraft = () => {
    setDraft({ url: "", thumbnailUrl: "", title: "" })
    setEditingId(null)
  }

  const saveDraft = () => {
    if (!draft.title.trim()) return
    if (subTab === "link" && !draft.url.trim()) return

    if (editingId) {
      onChange(
        blocks.map((b) =>
          b.id === editingId
            ? { ...b, type: subTab, title: draft.title.trim(), url: draft.url.trim(), thumbnailUrl: draft.thumbnailUrl.trim() }
            : b
        )
      )
    } else {
      onChange([
        ...blocks,
        {
          ...newShoppingLinkBlock(subTab, blocks.length),
          title: draft.title.trim(),
          url: draft.url.trim(),
          thumbnailUrl: draft.thumbnailUrl.trim(),
        },
      ])
    }
    resetDraft()
  }

  const startEdit = (block: ShoppingLinkBlock) => {
    setEditingId(block.id)
    setSubTab(block.type)
    setDraft({ url: block.url, thumbnailUrl: block.thumbnailUrl, title: block.title })
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {(["link", "text"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setSubTab(tab)
              resetDraft()
            }}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium",
              subTab === tab ? cn(studio.btnSegmentActive, "rounded-full") : "text-slate-400 hover:text-slate-200"
            )}
          >
            {tab === "link" ? "링크" : "텍스트"}
          </button>
        ))}
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        {subTab === "link" ? (
          <>
            <div className="space-y-1">
              <Label className="text-slate-400">상품 URL을 붙여넣으세요</Label>
              <Input
                value={draft.url}
                onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
                placeholder="https://link.coupang.com/..."
                className="border-slate-700 bg-slate-950 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-400">썸네일 URL (직접 입력 또는 업로드)</Label>
              <Input
                value={draft.thumbnailUrl}
                onChange={(e) => setDraft((d) => ({ ...d, thumbnailUrl: e.target.value }))}
                placeholder="https://..."
                className="border-slate-700 bg-slate-950 text-white"
              />
            </div>
          </>
        ) : null}
        <div className="space-y-1">
          <Label className="text-slate-400">{subTab === "link" ? "상품명" : "텍스트 내용"}</Label>
          <Input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder={subTab === "link" ? "상품명" : "표시할 텍스트"}
            className="border-slate-700 bg-slate-950 text-white"
          />
        </div>
        <Button type="button" variant="ghost" className={cn(studio.btnPrimary, "w-full")} onClick={saveDraft}>
          {editingId ? "수정" : "저장"}
        </Button>
      </div>

      <div className="space-y-2">
        {sorted.map((block, index) => (
          <div key={block.id} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            <GripVertical className="mt-1 h-4 w-4 shrink-0 text-slate-600" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", block.type === "link" ? "bg-rose-500/20 text-rose-300" : "bg-sky-500/20 text-sky-300")}>
                  {block.type === "link" ? "링크" : "텍스트"}
                </span>
                <span className="text-xs text-slate-500">{String(index + 1).padStart(2, "0")}</span>
              </div>
              <p className="font-medium text-white">{block.title}</p>
              {block.url ? <p className="truncate text-xs text-slate-500">{block.url}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                className={cn("rounded p-1.5", block.pinned ? "text-amber-400" : "text-slate-500 hover:text-slate-300")}
                onClick={() => onChange(blocks.map((b) => (b.id === block.id ? { ...b, pinned: !b.pinned } : b)))}
              >
                <Pin className="h-4 w-4" />
              </button>
              <Switch
                checked={block.enabled}
                onCheckedChange={(checked) => onChange(blocks.map((b) => (b.id === block.id ? { ...b, enabled: checked } : b)))}
              />
              <button type="button" className="rounded p-1.5 text-slate-500 hover:text-slate-300" onClick={() => startEdit(block)}>
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded p-1.5 text-slate-500 hover:text-rose-400"
                onClick={() => onChange(blocks.filter((b) => b.id !== block.id))}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {message ? <p className="text-sm text-emerald-400">{message}</p> : null}

      <Button
        type="button"
        disabled={saving}
        className="w-full bg-gradient-to-r from-pink-500 to-violet-500"
        onClick={() => void onSave()}
      >
        {saving ? "게시 중…" : "블록 저장 · 페이지에 반영"}
      </Button>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { Folder, FolderPlus, Plus, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  createChannelGroup,
  createVideoGroup,
  loadChannelGroups,
  loadVideoGroups,
  saveChannelGroups,
  saveVideoGroups,
} from "../lib/groups-storage"

type Kind = "channel" | "video"

export function FavoritePickerModal({
  open,
  kind,
  itemLabel,
  saving,
  onClose,
  onPick,
}: {
  open: boolean
  kind: Kind
  itemLabel?: string
  saving?: boolean
  onClose: () => void
  onPick: (groupId: string) => void | Promise<void>
}) {
  const [items, setItems] = useState<Array<{ id: string; name: string; count: number }>>([])
  const [newName, setNewName] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    if (kind === "channel") {
      setItems(
        loadChannelGroups().map((g) => ({
          id: g.id,
          name: g.name,
          count: g.channels.length,
        }))
      )
    } else {
      setItems(
        loadVideoGroups().map((g) => ({
          id: g.id,
          name: g.name,
          count: g.videos.length,
        }))
      )
    }
  }, [open, kind])

  if (!open) return null

  const title = kind === "channel" ? "관심 채널에 저장" : "관심 영상에 저장"
  const unit = kind === "channel" ? "채널" : "영상"

  const handleCreate = async () => {
    if (kind === "channel") {
      const g = createChannelGroup(newName)
      const next = [g, ...loadChannelGroups()]
      saveChannelGroups(next)
      setItems([{ id: g.id, name: g.name, count: 0 }, ...items])
      setNewName("")
      await pick(g.id)
    } else {
      const g = createVideoGroup(newName)
      const next = [g, ...loadVideoGroups()]
      saveVideoGroups(next)
      setItems([{ id: g.id, name: g.name, count: 0 }, ...items])
      setNewName("")
      await pick(g.id)
    }
  }

  const pick = async (id: string) => {
    setBusy(true)
    try {
      await onPick(id)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const loading = busy || saving

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="닫기"
        onClick={onClose}
        disabled={loading}
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#121316] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-zinc-50">{title}</h3>
            {itemLabel && (
              <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{itemLabel}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-xl text-zinc-400 hover:bg-white/10"
            onClick={onClose}
            disabled={loading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto px-4 py-3">
          {items.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-500">
              그룹이 없습니다. 아래에서 새로 만드세요.
            </p>
          )}
          {items.map((g) => (
            <button
              key={g.id}
              type="button"
              disabled={loading}
              onClick={() => void pick(g.id)}
              className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-3 text-left transition hover:border-teal-400/40 hover:bg-teal-500/10 disabled:opacity-50"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-sky-600 text-white">
                <Folder className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-zinc-100">{g.name}</span>
                <span className="text-[11px] text-zinc-500">
                  {g.count}개 {unit}
                </span>
              </span>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-teal-300" />}
            </button>
          ))}
        </div>

        <div className="border-t border-white/[0.06] px-4 py-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs text-zinc-500">
            <FolderPlus className="h-3.5 w-3.5 text-teal-300" />
            새 그룹 만들기
          </p>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="그룹 이름"
              className="h-10 rounded-xl border-white/10 bg-black/40 text-sm text-zinc-100"
              onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
              disabled={loading}
            />
            <Button
              onClick={() => void handleCreate()}
              disabled={loading}
              className="h-10 shrink-0 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 px-3"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

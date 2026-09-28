"use client"

import { useCallback, useRef, useState } from "react"
import { loadApiKeys } from "@/lib/longform-v2/api-keys"
import { buildDetailModeTitleHint } from "@/lib/longform-v2/title-hint"
import { stripHashtagLinesFromYoutubeDescription } from "@/lib/longform-v2/youtube-description"
import { TitleDescModal, type TitleItem, type TitleMeta } from "./TitleDescModal"

type Options = {
  script: string
  onInfo: (msg: string) => void
  onError: (msg: string | null) => void
  onSaveMeta?: (payload: {
    youtubeTitle: string
    youtubeDescription: string
    youtubeHashtags: string
    youtubeUploadTags: string[]
    youtubePinnedComment: string
  }) => void
}

function emptyMeta(loading = false): TitleMeta {
  return {
    description: "",
    hashtags: "",
    uploadTags: [],
    pinnedComment: "",
    loading,
    error: null,
  }
}

/** WingsStudio useDetailModeTitleDesc 대응 */
export function useTitleDesc({ script, onInfo, onError, onSaveMeta }: Options) {
  const [items, setItems] = useState<TitleItem[]>([])
  const [busy, setBusy] = useState(false)
  const [selectedTitle, setSelectedTitle] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [metaByTitle, setMetaByTitle] = useState<Record<string, TitleMeta>>({})
  const abortRef = useRef(0)

  const selectedItem = items.find((it) => it.title === selectedTitle) ?? null
  const selectedMeta = selectedTitle ? metaByTitle[selectedTitle] : undefined

  const loadTitleMeta = useCallback(
    (title: string) => {
      const t = title.trim()
      const rawScript = script.trim()
      if (!t || !rawScript) return

      setMetaByTitle((prev) => {
        const cur = prev[t]
        if (cur?.loading) return prev
        if (cur && cur.description.trim() && !cur.error) return prev
        return { ...prev, [t]: emptyMeta(true) }
      })

      const gen = ++abortRef.current
      void (async () => {
        try {
          const keys = loadApiKeys()
          const res = await fetch("/api/longform-v2/generate-youtube-description", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              script: rawScript,
              title: t,
              category: "롱폼 · 빠른 모드",
              geminiApiKey: keys.gemini,
            }),
          })
          const data = await res.json()
          if (abortRef.current !== gen) return
          if (!res.ok || !data.success) throw new Error(data.error || "설명 생성 실패")
          const meta: TitleMeta = {
            description: stripHashtagLinesFromYoutubeDescription(String(data.description || "")),
            hashtags: String(data.hashtags || ""),
            uploadTags: Array.isArray(data.uploadTags) ? data.uploadTags.map(String) : [],
            pinnedComment: String(data.pinnedComment || ""),
            loading: false,
            error: null,
          }
          setMetaByTitle((prev) => ({ ...prev, [t]: meta }))
          onSaveMeta?.({
            youtubeTitle: t,
            youtubeDescription: meta.description,
            youtubeHashtags: meta.hashtags,
            youtubeUploadTags: meta.uploadTags,
            youtubePinnedComment: meta.pinnedComment,
          })
        } catch (e) {
          if (abortRef.current !== gen) return
          setMetaByTitle((prev) => ({
            ...prev,
            [t]: {
              ...(prev[t] ?? emptyMeta()),
              loading: false,
              error: e instanceof Error ? e.message : String(e),
            },
          }))
        }
      })()
    },
    [onSaveMeta, script]
  )

  const selectTitle = useCallback(
    (title: string) => {
      setSelectedTitle(title)
      loadTitleMeta(title)
    },
    [loadTitleMeta]
  )

  const onGenerate = async () => {
    const raw = script.trim()
    if (!raw) {
      onError("대본이 없습니다. 대본을 저장한 뒤 다시 시도하세요.")
      return
    }
    const gen = ++abortRef.current
    setModalOpen(true)
    setBusy(true)
    setMetaByTitle({})
    onError(null)
    try {
      const keys = loadApiKeys()
      const res = await fetch("/api/longform-v2/generate-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "한국어",
          hint: buildDetailModeTitleHint(raw),
          contentType: "롱폼 · 빠른 모드 대본",
          count: 5,
          geminiApiKey: keys.gemini,
        }),
      })
      const data = await res.json()
      if (abortRef.current !== gen) return
      if (!res.ok || !data.success) throw new Error(data.error || "제목 생성 실패")
      const list = (Array.isArray(data.items) ? data.items : []) as TitleItem[]
      setItems(list.slice(0, 5))
      setSelectedTitle("")
      onInfo(
        list.length
          ? `제목·설명 후보 ${list.length}개를 만들었습니다. 제목을 눌러 설명·태그를 확인하세요.`
          : "제목 후보가 비었습니다."
      )
    } catch (e) {
      if (abortRef.current !== gen) return
      setItems([])
      setSelectedTitle("")
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      if (abortRef.current === gen) setBusy(false)
    }
  }

  const copyField = async (label: string, text: string) => {
    const v = text.trim()
    if (!v) {
      onError(`${label}에 복사할 내용이 없습니다.`)
      return
    }
    try {
      await navigator.clipboard.writeText(v)
      onInfo(`${label}을(를) 클립보드에 복사했습니다.`)
    } catch {
      onError("복사에 실패했습니다.")
    }
  }

  return {
    items,
    busy,
    modalOpen,
    selectedTitle,
    selectTitle,
    selectedItem,
    selectedMeta,
    startGenerate: () => void onGenerate(),
    openModal: () => setModalOpen(true),
    closeModal: () => {
      abortRef.current++
      setBusy(false)
      setModalOpen(false)
    },
    copyField,
    canGenerate: Boolean(script.trim()),
    TitleDescModalEl: (
      <TitleDescModal
        open={modalOpen}
        busy={busy}
        items={items}
        selectedTitle={selectedTitle}
        selectedItem={selectedItem}
        selectedMeta={selectedMeta}
        onClose={() => {
          abortRef.current++
          setBusy(false)
          setModalOpen(false)
        }}
        onSelectTitle={selectTitle}
        onCopyField={(label, text) => void copyField(label, text)}
        onRegenerate={() => void onGenerate()}
      />
    ),
  }
}

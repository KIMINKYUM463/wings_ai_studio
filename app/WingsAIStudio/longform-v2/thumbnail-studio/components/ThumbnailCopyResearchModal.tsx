import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ThumbnailCopyResearchItem, ThumbnailCopyResearchResult } from '@/lib/longform-v2/youtube/thumbnailCopyResearch'
import type { ThumbnailCopyResearchSession } from '@/lib/longform-v2/thumbnailTemplateStudio/copyResearchStorage'
import {
  postThumbnailCopyCombos,
  postThumbnailCopyKeywordSuggest,
  postThumbnailCopyResearch,
  postThumbnailSubCopies,
} from '@/lib/longform-v2/thumbnail-bridge/thumbnailCopyResearchApi'
import { hasStoredYoutubeDataApiKey } from '@/lib/longform-v2/thumbnail-bridge/youtubeDataLocalStorage'
import type { ThumbnailCopyCombo } from '@/lib/longform-v2/youtube/thumbnailCopyCombos'
import { subCopyToReplacement } from '@/lib/longform-v2/youtube/thumbnailSubCopy'
import type { ThumbnailSubCopy } from '@/lib/longform-v2/youtube/thumbnailSubCopy'
import {
  addSubCopyAsTextLayerToDocument,
  applyCopyComboToDocument,
  applySlotReplacementsToDocument,
  resolveSubCopySlotSpec,
  resolveTwoLineCopySlotSpec,
} from '@/lib/longform-v2/thumbnailTemplateStudio/document'
import type { ThumbnailStudioDocument } from '@/lib/longform-v2/thumbnailTemplateStudio/types'
import { CopyComboLineRow } from './CopyComboLineRow'

type Props = {
  open: boolean
  onClose: () => void
  topic: string
  script: string
  titleHint?: string
  outputLanguage: string
  document: ThumbnailStudioDocument
  onApplyDocument: (doc: ThumbnailStudioDocument) => void
  session: ThumbnailCopyResearchSession
  onSessionChange: (session: ThumbnailCopyResearchSession) => void
  onManualWork?: (session: ThumbnailCopyResearchSession) => void
  selectedComboId?: string | null
  onSelectedComboChange?: (id: string | null) => void
  selectedSubCopyId?: string | null
  onSelectedSubCopyChange?: (id: string | null) => void
  onInfo?: (msg: string) => void
  onError?: (msg: string) => void
}

function formatViews(n: number): string {
  return n.toLocaleString('ko-KR')
}

const RESEARCH_MONTHS = 12
const MAX_SUGGEST_KEYWORDS = 4
const EMPTY_COMBOS: ThumbnailCopyCombo[] = []
const EMPTY_SUB_COPIES: ThumbnailSubCopy[] = []

async function fetchAiKeywords(topic: string): Promise<string[]> {
  const t = topic.trim()
  if (!t) return []
  const res = await postThumbnailCopyKeywordSuggest({ topic: t })
  return (res.keywords ?? []).slice(0, MAX_SUGGEST_KEYWORDS)
}

function pickDefaultSearchKeyword(keywords: string[], current: string): string {
  const trimmed = current.trim()
  if (trimmed && keywords.includes(trimmed)) return trimmed
  return keywords[0]?.trim() ?? ''
}

export function ThumbnailCopyResearchModal({
  open,
  onClose,
  topic,
  script,
  titleHint,
  outputLanguage,
  document: studioDoc,
  onApplyDocument,
  session,
  onSessionChange,
  onManualWork,
  selectedComboId: selectedComboIdProp,
  onSelectedComboChange,
  selectedSubCopyId: selectedSubCopyIdProp,
  onSelectedSubCopyChange,
  onInfo,
  onError,
}: Props) {
  const titleId = useId()
  const wasOpenRef = useRef(false)
  const keywordFetchKeyRef = useRef<string | null>(null)
  const [topicDraft, setTopicDraft] = useState(session.topicDraft || topic)
  const [aiKeywords, setAiKeywords] = useState<string[]>(session.aiKeywords)
  const [selectedSearchKeyword, setSelectedSearchKeyword] = useState(
    session.selectedSearchKeyword ?? '',
  )
  const [keywordsLoading, setKeywordsLoading] = useState(false)
  const [researchBusy, setResearchBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [result, setResult] = useState<ThumbnailCopyResearchResult | null>(session.result)
  const [combos, setCombos] = useState<ThumbnailCopyCombo[]>(session.aiCombos ?? EMPTY_COMBOS)
  const [subCopies, setSubCopies] = useState<ThumbnailSubCopy[]>(
    session.aiSubCopies ?? EMPTY_SUB_COPIES,
  )
  const [selectedComboIdLocal, setSelectedComboIdLocal] = useState<string | null>(null)
  const [selectedSubCopyIdLocal, setSelectedSubCopyIdLocal] = useState<string | null>(null)
  const selectedComboId = selectedComboIdProp ?? selectedComboIdLocal
  const selectedSubCopyId = selectedSubCopyIdProp ?? selectedSubCopyIdLocal
  const setSelectedComboId = (id: string | null) => {
    setSelectedComboIdLocal(id)
    onSelectedComboChange?.(id)
  }
  const setSelectedSubCopyId = (id: string | null) => {
    setSelectedSubCopyIdLocal(id)
    onSelectedSubCopyChange?.(id)
  }
  const [subCopyBusy, setSubCopyBusy] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [youtubeKeyOwn, setYoutubeKeyOwn] = useState(hasStoredYoutubeDataApiKey())

  useEffect(() => {
    if (!open) return
    setYoutubeKeyOwn(hasStoredYoutubeDataApiKey())
  }, [open])

  const patchSession = useCallback(
    (partial: Partial<ThumbnailCopyResearchSession>) => {
      onSessionChange({
        topicDraft,
        aiKeywords,
        selectedSearchKeyword,
        result,
        manualPanelOpen: session.manualPanelOpen,
        aiCombos: combos,
        slotSpec: session.slotSpec,
        aiSubCopies: subCopies,
        subCopySlotSpec: session.subCopySlotSpec,
        userNotes: session.userNotes,
        panelHeight: session.panelHeight,
        ...partial,
      })
    },
    [
      topicDraft,
      aiKeywords,
      selectedSearchKeyword,
      result,
      combos,
      subCopies,
      session.manualPanelOpen,
      session.slotSpec,
      session.subCopySlotSpec,
      session.userNotes,
      session.panelHeight,
      onSessionChange,
    ],
  )

  const loadAiKeywords = useCallback(
    async (topicText: string) => {
      const t = topicText.trim()
      if (!t) {
        setAiKeywords([])
        setSelectedSearchKeyword('')
        patchSession({ aiKeywords: [], selectedSearchKeyword: '', topicDraft: t })
        return []
      }
      setKeywordsLoading(true)
      try {
        const keywords = await fetchAiKeywords(t)
        const nextSelected = pickDefaultSearchKeyword(keywords, selectedSearchKeyword)
        setAiKeywords(keywords)
        setSelectedSearchKeyword(nextSelected)
        patchSession({ aiKeywords: keywords, selectedSearchKeyword: nextSelected, topicDraft: t })
        return keywords
      } catch (e) {
        setAiKeywords([])
        setSelectedSearchKeyword('')
        onError?.(e instanceof Error ? e.message : '키워드 추출에 실패했습니다.')
        return []
      } finally {
        setKeywordsLoading(false)
      }
    },
    [onError, patchSession, selectedSearchKeyword],
  )

  /** 모달이 막 열렸을 때만 세션 → 로컬 동기화 (session 갱신마다 돌리면 무한 렌더) */
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current
    wasOpenRef.current = open
    if (!open) {
      keywordFetchKeyRef.current = null
      return
    }
    if (!justOpened) return

    setTopicDraft(session.topicDraft || topic)
    setAiKeywords(session.aiKeywords)
    setSelectedSearchKeyword(
      pickDefaultSearchKeyword(session.aiKeywords, session.selectedSearchKeyword ?? ''),
    )
    setResult(session.result)
    setCombos(session.aiCombos?.length ? session.aiCombos : EMPTY_COMBOS)
    setSubCopies(session.aiSubCopies?.length ? session.aiSubCopies : EMPTY_SUB_COPIES)
    setSelectedComboId(null)
    setSelectedSubCopyId(null)
    setExpandedId(null)
    keywordFetchKeyRef.current = null
    // open 전환 시에만 동기화 — session/topic은 justOpened 순간의 값 사용
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session, topic])

  /** 키워드가 없을 때 주제당 1회만 추출 */
  useEffect(() => {
    if (!open) return
    if (session.aiKeywords.length || session.result) return
    const t = (session.topicDraft || topic).trim()
    if (!t) return
    if (keywordFetchKeyRef.current === t) return
    keywordFetchKeyRef.current = t
    void loadAiKeywords(t)
  }, [open, session.aiKeywords.length, session.result, session.topicDraft, topic, loadAiKeywords])

  useEffect(() => {
    if (!open) return
    const t = topicDraft.trim()
    if (!t || t === (session.topicDraft || topic).trim()) return
    const timer = window.setTimeout(() => {
      if (keywordFetchKeyRef.current === t) return
      keywordFetchKeyRef.current = t
      void loadAiKeywords(t)
    }, 700)
    return () => window.clearTimeout(timer)
  }, [open, topicDraft, session.topicDraft, topic, loadAiKeywords])

  const searchKeywordLabel = useMemo(() => {
    if (result?.keywords?.length) return result.keywords.join(' · ')
    return selectedSearchKeyword.trim() || aiKeywords[0] || ''
  }, [result, selectedSearchKeyword, aiKeywords])

  const onCollect = useCallback(async () => {
    const t = topicDraft.trim()
    if (!t) {
      onError?.('주제를 입력해 주세요.')
      return
    }
    let searchKeyword = selectedSearchKeyword.trim()
    if (!searchKeyword) {
      const loaded = await loadAiKeywords(t)
      searchKeyword = pickDefaultSearchKeyword(loaded, '')
    }
    if (!searchKeyword) {
      onError?.('검색 키워드를 선택해 주세요. (AI 추출 후 칩 1개 클릭)')
      return
    }
    setResearchBusy(true)
    try {
      const res = await postThumbnailCopyResearch({
        topic: t,
        keywords: [searchKeyword],
        maxItems: 10,
        months: RESEARCH_MONTHS,
      })
      setResult(res)
      setSelectedSearchKeyword(searchKeyword)
      onSessionChange({
        topicDraft: t,
        aiKeywords,
        selectedSearchKeyword: searchKeyword,
        result: res,
        manualPanelOpen: session.manualPanelOpen,
        aiCombos: combos,
        slotSpec: session.slotSpec,
        aiSubCopies: subCopies,
        subCopySlotSpec: session.subCopySlotSpec,
      })
      onInfo?.(
        `「${searchKeyword}」 검색 · 롱폼(3분+)·고조회 참고 ${res.items.length}건을 수집했습니다.`,
      )
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e))
    } finally {
      setResearchBusy(false)
    }
  }, [
    topicDraft,
    selectedSearchKeyword,
    aiKeywords,
    combos,
    subCopies,
    loadAiKeywords,
    onError,
    onInfo,
    onSessionChange,
    session.manualPanelOpen,
    session.slotSpec,
    session.subCopySlotSpec,
  ])

  const applyCombo = useCallback(
    (combo: ThumbnailCopyCombo) => {
      const spec = session.slotSpec ?? resolveTwoLineCopySlotSpec(studioDoc)
      if (!spec) {
        onError?.('이 템플릿에서 2줄 슬롯을 찾을 수 없습니다.')
        return
      }
      const next = applyCopyComboToDocument(studioDoc, combo, spec)
      onApplyDocument(next)
      setSelectedComboId(combo.id)
      onSessionChange({
        topicDraft: topicDraft.trim(),
        aiKeywords,
        result,
        manualPanelOpen: true,
        aiCombos: combos,
        slotSpec: spec,
      })
      onInfo?.('선택한 2줄 조합을 썸네일에 적용했습니다.')
    },
    [
      session.slotSpec,
      studioDoc,
      onApplyDocument,
      onSessionChange,
      topicDraft,
      aiKeywords,
      result,
      combos,
      onInfo,
      onError,
    ],
  )

  const onAiCombine = useCallback(async () => {
    if (!result?.items?.length) {
      onError?.('먼저 「참고 수집」으로 유튜브 카피를 가져와 주세요.')
      return
    }
    const slotSpec = resolveTwoLineCopySlotSpec(studioDoc)
    if (!slotSpec) {
      onError?.('이 템플릿은 2줄 카피 조합을 지원하지 않습니다.')
      return
    }
    const scriptBody =
      script.trim() ||
      topicDraft.trim() ||
      titleHint?.trim() ||
      ''
    if (!scriptBody) {
      onError?.('대본 또는 주제가 필요합니다.')
      return
    }
    setAiBusy(true)
    setCombos([])
    setSubCopies([])
    setSelectedComboId(null)
    setSelectedSubCopyId(null)
    const subCopySlot = resolveSubCopySlotSpec(studioDoc)
    const subGenSpec = subCopySlot ?? { subKey: 'sub', subLabel: '서브카피', subMax: 16 }
    try {
      const basePayload = {
        templateId: studioDoc.templateId,
        topic: topicDraft.trim() || titleHint?.trim() || 'YouTube',
        scriptExcerpt: scriptBody,
        videoTitle: titleHint?.trim() || undefined,
        outputLanguage,
        researchItems: result.items,
      }
      const [{ combos: generated }, { subCopies: generatedSub }] = await Promise.all([
        postThumbnailCopyCombos({ ...basePayload, slotSpec, count: 15 }),
        postThumbnailSubCopies({ ...basePayload, slotSpec: subGenSpec, count: 10 }),
      ])
      setCombos(generated)
      setSubCopies(generatedSub)
      const nextSession: ThumbnailCopyResearchSession = {
        topicDraft: topicDraft.trim(),
        aiKeywords,
        result,
        manualPanelOpen: true,
        aiCombos: generated,
        slotSpec,
        aiSubCopies: generatedSub,
        subCopySlotSpec: subCopySlot ?? session.subCopySlotSpec,
      }
      onSessionChange(nextSession)
      onManualWork?.(nextSession)
      onInfo?.(
        subCopySlot
          ? `추천 2줄 조합 ${generated.length}개 · 서브카피 ${generatedSub.length}개를 만들었습니다. 캔버스 옆 패널에서 고르세요.`
          : `추천 2줄 조합 ${generated.length}개 · 서브카피 ${generatedSub.length}개를 만들었습니다. (서브카피 슬롯 없음 — 복사·수동 붙여넣기)`,
      )
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e))
    } finally {
      setAiBusy(false)
    }
  }, [
    result,
    studioDoc,
    script,
    topicDraft,
    titleHint,
    outputLanguage,
    aiKeywords,
    session.subCopySlotSpec,
    onSessionChange,
    onManualWork,
    onError,
    onInfo,
  ])

  const addSubCopyToCanvas = useCallback(
    (sub: ThumbnailSubCopy) => {
      const spec = session.subCopySlotSpec ?? resolveSubCopySlotSpec(studioDoc)
      const { document: next, layerId: _layerId } = addSubCopyAsTextLayerToDocument(
        studioDoc,
        sub.text,
        spec?.subMax,
      )
      onApplyDocument(next)
      setSelectedSubCopyId(sub.id)
      onSessionChange({
        topicDraft: topicDraft.trim(),
        aiKeywords,
        result,
        manualPanelOpen: true,
        aiCombos: combos,
        slotSpec: session.slotSpec,
        aiSubCopies: subCopies,
        subCopySlotSpec: spec ?? session.subCopySlotSpec,
      })
      onInfo?.(`서브카피를 썸네일에 추가했습니다: ${sub.text}`)
    },
    [
      session.subCopySlotSpec,
      session.slotSpec,
      studioDoc,
      onApplyDocument,
      onSessionChange,
      topicDraft,
      aiKeywords,
      result,
      combos,
      subCopies,
      onInfo,
    ],
  )

  const applySubCopy = useCallback(
    (sub: ThumbnailSubCopy) => {
      const spec = session.subCopySlotSpec ?? resolveSubCopySlotSpec(studioDoc)
      if (!spec) {
        void navigator.clipboard?.writeText(sub.text).then(() => {
          setSelectedSubCopyId(sub.id)
          onInfo?.(`서브카피를 클립보드에 복사했습니다: ${sub.text}`)
        }).catch(() => {
          onError?.('이 템플릿에 서브카피 슬롯이 없습니다. 참고 패널 메모에 적어 두세요.')
        })
        return
      }
      const next = applySlotReplacementsToDocument(studioDoc, subCopyToReplacement(sub, spec))
      onApplyDocument(next)
      setSelectedSubCopyId(sub.id)
      onSessionChange({
        topicDraft: topicDraft.trim(),
        aiKeywords,
        result,
        manualPanelOpen: true,
        aiCombos: combos,
        slotSpec: session.slotSpec,
        aiSubCopies: subCopies,
        subCopySlotSpec: spec,
      })
      onInfo?.(`서브카피를 썸네일에 적용했습니다: ${sub.text}`)
    },
    [
      session.subCopySlotSpec,
      session.slotSpec,
      studioDoc,
      onApplyDocument,
      onSessionChange,
      topicDraft,
      aiKeywords,
      result,
      combos,
      subCopies,
      onInfo,
      onError,
    ],
  )

  const onAiSubCopy = useCallback(async () => {
    if (!result?.items?.length) {
      onError?.('먼저 「참고 수집」으로 유튜브 카피를 가져와 주세요.')
      return
    }
    const slotSpec = resolveSubCopySlotSpec(studioDoc)
    const genSpec = slotSpec ?? { subKey: 'sub', subLabel: '서브카피', subMax: 16 }
    const scriptBody =
      script.trim() ||
      topicDraft.trim() ||
      titleHint?.trim() ||
      ''
    if (!scriptBody) {
      onError?.('대본 또는 주제가 필요합니다.')
      return
    }
    setSubCopyBusy(true)
    setSubCopies([])
    setSelectedSubCopyId(null)
    try {
      const { subCopies: generated } = await postThumbnailSubCopies({
        templateId: studioDoc.templateId,
        topic: topicDraft.trim() || titleHint?.trim() || 'YouTube',
        scriptExcerpt: scriptBody,
        videoTitle: titleHint?.trim() || undefined,
        outputLanguage,
        slotSpec: genSpec,
        researchItems: result.items,
        count: 10,
      })
      setSubCopies(generated)
      onSessionChange({
        topicDraft: topicDraft.trim(),
        aiKeywords,
        result,
        manualPanelOpen: true,
        aiCombos: combos,
        slotSpec: session.slotSpec,
        aiSubCopies: generated,
        subCopySlotSpec: slotSpec ?? session.subCopySlotSpec,
      })
      onManualWork?.({
        topicDraft: topicDraft.trim(),
        aiKeywords,
        result,
        manualPanelOpen: true,
        aiCombos: combos,
        slotSpec: session.slotSpec,
        aiSubCopies: generated,
        subCopySlotSpec: slotSpec ?? session.subCopySlotSpec,
      })
      onInfo?.(
        slotSpec
          ? `서브카피 ${generated.length}개를 만들었습니다. ('효' 강조)처럼 괄호 라벨을 고르세요.`
          : `서브카피 ${generated.length}개 — 템플릿 슬롯이 없어 적용 시 클립보드로 복사됩니다.`,
      )
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e))
    } finally {
      setSubCopyBusy(false)
    }
  }, [
    result,
    studioDoc,
    script,
    topicDraft,
    titleHint,
    outputLanguage,
    aiKeywords,
    combos,
    session.slotSpec,
    session.subCopySlotSpec,
    onSessionChange,
    onManualWork,
    onError,
    onInfo,
  ])

  const onManualWorkClick = useCallback(() => {
    if (!result?.items?.length) {
      onError?.('먼저 「유튜브 참고 수집」으로 참고 문구를 가져와 주세요.')
      return
    }
    const nextSession: ThumbnailCopyResearchSession = {
      topicDraft: topicDraft.trim(),
      aiKeywords,
      result,
      manualPanelOpen: true,
    }
    onSessionChange(nextSession)
    onManualWork?.(nextSession)
    onInfo?.('캔버스 왼쪽 참고 패널에서 문구를 보며 직접 편집하세요.')
  }, [result, topicDraft, aiKeywords, onSessionChange, onManualWork, onInfo, onError])

  if (!open) return null

  return (
    <div className="thumb-tpl-modal thumb-copy-research-modal" role="dialog" aria-labelledby={titleId}>
      <button type="button" className="thumb-tpl-modal__backdrop" aria-label="닫기" onClick={onClose} />
      <div className="thumb-tpl-modal__panel thumb-copy-research-modal__panel">
        <div className="thumb-tpl-modal__head">
          <h2 id={titleId} className="thumb-tpl-modal__title">
            카피라이팅 참고 · AI 조합
          </h2>
          <button type="button" className="thumb-tpl-modal__close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <p className="thumb-tpl-modal__lead">
          주제 키워드와 영상 제목으로 YouTube <strong>롱폼</strong> 고조회 영상(쇼츠 제외)을 검색해{' '}
          <strong>제목·썸네일 문구</strong>를 약 10개 모읍니다. <strong>AI 조합</strong>은 템플릿에 맞는{' '}
          <strong>2줄 카피 조합</strong>과 <strong>괄호형 서브카피</strong>를 여러 개 만든 뒤, 원하는 것만 썸네일에 적용합니다.
        </p>
        {!youtubeKeyOwn ? (
          <p className="thumb-ui-hint thumb-copy-research-modal__yt-key-warn" role="status">
            이 PC에 YouTube Data API 키가 없어 서버/배포 기본 키를 사용합니다.{' '}
            <strong>하루 검색 할당량(약 100회)</strong>을 여러 사용자가 나눠 씁니다.{' '}
            <strong>설정 → YouTube Data API 키</strong>에 본인 Google Cloud 키를 저장하세요.
          </p>
        ) : null}
        <p className="thumb-ui-hint thumb-copy-research-modal__quota-hint">
          참고 수집 1회는 YouTube <strong>검색 API 1번</strong>만 사용합니다(영상 상세 조회는 별도·
          저렴). 무료 프로젝트는 검색 <strong>하루 약 100번</strong> 한도입니다.
        </p>

        <section className="thumb-copy-research-modal__section">
          <label className="thumb-ui-label" htmlFor="thumb-copy-research-topic">
            영상 주제
          </label>
          <input
            id="thumb-copy-research-topic"
            className="thumb-ui-input"
            value={topicDraft}
            onChange={(e) => {
              const v = e.target.value
              setTopicDraft(v)
              // 타이핑마다 부모 session을 갱신하지 않음 — 키워드 추출/수집 시에만 patchSession
            }}
            placeholder="예: 우주의 크기, 역사 미스터리…"
          />
        </section>

        <section className="thumb-copy-research-modal__section">
          <div className="thumb-copy-research-modal__kw-head">
            <span className="thumb-ui-label">핵심 검색 키워드 (1개 선택 · YouTube 검색 1회)</span>
            <button
              type="button"
              className="thumb-ui-btn thumb-ui-btn--ghost thumb-ui-btn--sm"
              disabled={keywordsLoading || researchBusy || aiBusy || !topicDraft.trim()}
              onClick={() => void loadAiKeywords(topicDraft)}
            >
              {keywordsLoading ? '추출 중…' : '↻ 다시 추출'}
            </button>
          </div>
          <p className="thumb-ui-hint">
            {keywordsLoading
              ? 'AI가 주제의 핵심 키워드 4개를 추출하는 중…'
              : 'AI가 제안한 키워드 중 하나를 고른 뒤 「유튜브 참고 수집」을 누르세요.'}
          </p>
          <div className="thumb-copy-research-modal__keywords" role="group" aria-label="검색 키워드 선택">
            {keywordsLoading && !aiKeywords.length ? (
              <span className="thumb-copy-research-modal__kw-chip thumb-copy-research-modal__kw-chip--loading">
                추출 중…
              </span>
            ) : aiKeywords.length ? (
              aiKeywords.map((kw, i) => {
                const selected = selectedSearchKeyword === kw
                return (
                  <button
                    key={`${kw}-${i}`}
                    type="button"
                    className={
                      selected
                        ? 'thumb-copy-research-modal__kw-chip thumb-copy-research-modal__kw-chip--on'
                        : 'thumb-copy-research-modal__kw-chip'
                    }
                    aria-pressed={selected}
                    disabled={researchBusy || keywordsLoading}
                    onClick={() => {
                      setSelectedSearchKeyword(kw)
                      patchSession({ selectedSearchKeyword: kw })
                    }}
                  >
                    {kw}
                  </button>
                )
              })
            ) : (
              <span className="thumb-ui-hint">영상 주제를 입력하면 AI 키워드가 표시됩니다.</span>
            )}
          </div>
        </section>

        <div className="thumb-copy-research-modal__actions">
          <button
            type="button"
            className="thumb-ui-btn thumb-ui-btn--primary"
            disabled={researchBusy || aiBusy || keywordsLoading || !topicDraft.trim()}
            onClick={() => void onCollect()}
          >
            {researchBusy ? '수집 중…' : '🔍 유튜브 참고 수집'}
          </button>
          <button
            type="button"
            className="thumb-ui-btn thumb-ui-btn--outline"
            disabled={researchBusy || aiBusy || subCopyBusy || !result?.items?.length}
            onClick={() => void onAiCombine()}
          >
            {aiBusy ? 'AI 조합·서브카피 생성 중…' : '✦ AI 조합 + 서브카피'}
          </button>
          <button
            type="button"
            className="thumb-ui-btn thumb-ui-btn--outline"
            disabled={researchBusy || aiBusy || subCopyBusy || !result?.items?.length}
            onClick={() => void onAiSubCopy()}
          >
            {subCopyBusy ? '서브카피 생성 중…' : '↻ 서브카피만 다시'}
          </button>
          <button
            type="button"
            className="thumb-ui-btn thumb-ui-btn--ghost"
            disabled={researchBusy || aiBusy || subCopyBusy || !result?.items?.length}
            onClick={onManualWorkClick}
          >
            ✎ 수동작업 (참고 패널)
          </button>
        </div>

        {(combos.length > 0 || aiBusy) && (
          <section className="thumb-copy-research-modal__combos" aria-label="AI 추천 2줄 조합">
            <h3 className="thumb-copy-research-modal__combos-title">✦ 추천 조합 (2줄 · 템플릿 슬롯)</h3>
            <p className="thumb-ui-hint">
              {aiBusy && !combos.length
                ? '2줄 조합과 서브카피를 함께 만드는 중… 완료되면 우측 「추천 조합」·좌측 「카피 참고」 패널에 표시됩니다.'
                : `${combos.length}개 — 적용하거나 각 줄 「복사」로 클립보드에 넣을 수 있습니다.`}
            </p>
            {combos.length > 0 ? (
              <ul className="thumb-copy-research-modal__combo-list">
                {combos.map((combo) => (
                  <li key={combo.id} className="thumb-copy-research-modal__combo-item">
                    {combo.angle ? (
                      <span className="thumb-copy-research-modal__combo-angle">{combo.angle}</span>
                    ) : null}
                    <CopyComboLineRow
                      text={combo.line1}
                      lineClassName="thumb-copy-research-modal__combo-line1"
                      rowClassName="thumb-copy-research-modal__combo-line-row"
                      copyClassName="thumb-copy-research-modal__combo-line-copy"
                      onCopied={(t) => onInfo?.(`1줄 복사: ${t}`)}
                    />
                    <CopyComboLineRow
                      text={combo.line2}
                      lineClassName="thumb-copy-research-modal__combo-line2"
                      rowClassName="thumb-copy-research-modal__combo-line-row"
                      copyClassName="thumb-copy-research-modal__combo-line-copy"
                      onCopied={(t) => onInfo?.(`2줄 복사: ${t}`)}
                    />
                    <button
                      type="button"
                      className={
                        selectedComboId === combo.id
                          ? 'thumb-ui-btn thumb-ui-btn--primary thumb-ui-btn--sm'
                          : 'thumb-ui-btn thumb-ui-btn--outline thumb-ui-btn--sm'
                      }
                      onClick={() => applyCombo(combo)}
                    >
                      {selectedComboId === combo.id ? '적용됨' : '이 조합 적용'}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        )}

        {(subCopies.length > 0 || subCopyBusy || aiBusy) && (
          <section className="thumb-copy-research-modal__subcopies" aria-label="AI 서브카피">
            <h3 className="thumb-copy-research-modal__combos-title">✦ 서브카피 (괄호·라벨)</h3>
            <p className="thumb-ui-hint">
              {(subCopyBusy || aiBusy) && !subCopies.length
                ? '서브카피를 생성하는 중… 완료되면 「카피 참고」 패널에도 표시됩니다.'
                : `${subCopies.length}개 — ('효' 강조)처럼 이미지·키워드를 짚는 짧은 괄호 문구`}
            </p>
            {subCopies.length > 0 ? (
              <ul className="thumb-copy-research-modal__combo-list">
                {subCopies.map((sub) => (
                  <li
                    key={sub.id}
                    className={
                      'thumb-copy-research-modal__combo-item' +
                      (selectedSubCopyId === sub.id
                        ? ' thumb-copy-research-modal__combo-item--on'
                        : '')
                    }
                  >
                    {sub.angle ? (
                      <span className="thumb-copy-research-modal__combo-angle">{sub.angle}</span>
                    ) : null}
                    <p className="thumb-copy-research-modal__combo-line1">{sub.text}</p>
                    {sub.placementHint ? (
                      <p className="thumb-copy-research-modal__combo-line2">{sub.placementHint}</p>
                    ) : null}
                    <div className="thumb-copy-research-modal__subcopy-actions">
                      <button
                        type="button"
                        className="thumb-ui-btn thumb-ui-btn--primary thumb-ui-btn--sm"
                        onClick={() => addSubCopyToCanvas(sub)}
                      >
                        추가
                      </button>
                      <button
                        type="button"
                        className="thumb-ui-btn thumb-ui-btn--outline thumb-ui-btn--sm"
                        onClick={() => applySubCopy(sub)}
                      >
                        {(session.subCopySlotSpec ?? resolveSubCopySlotSpec(studioDoc))
                          ? '슬롯 적용'
                          : '복사'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        )}

        {result?.ocrWarnings?.length ? (
          <p className="thumb-copy-research-modal__warn">
            {result.ocrWarnings.slice(0, 2).join(' · ')}
          </p>
        ) : null}

        {result?.items?.length ? (
          <section className="thumb-copy-research-modal__results" aria-label="참고 영상 목록">
            <p className="thumb-copy-research-modal__meta">
              검색 키워드: {searchKeywordLabel || '—'} · 롱폼 3분+ · 고조회{' '}
              {result.items.length}건
            </p>
            <ul className="thumb-copy-research-modal__list">
              {result.items.map((item: ThumbnailCopyResearchItem) => (
                <li key={item.videoId} className="thumb-copy-research-modal__item">
                  <button
                    type="button"
                    className="thumb-copy-research-modal__item-head"
                    onClick={() =>
                      setExpandedId((prev) => (prev === item.videoId ? null : item.videoId))
                    }
                  >
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt=""
                        className="thumb-copy-research-modal__thumb"
                        loading="lazy"
                      />
                    ) : null}
                    <span className="thumb-copy-research-modal__item-text">
                      <strong>{item.title}</strong>
                      <span className="thumb-copy-research-modal__sub">
                        {item.channelTitle} · 조회 {formatViews(item.viewCount)}
                      </span>
                      {item.thumbnailLines.length ? (
                        <span className="thumb-copy-research-modal__copy">
                          썸네일: {item.thumbnailLines.join(' · ')}
                        </span>
                      ) : (
                        <span className="thumb-copy-research-modal__copy thumb-copy-research-modal__copy--muted">
                          썸네일 문구 없음 (제목만 참고)
                        </span>
                      )}
                    </span>
                  </button>
                  {expandedId === item.videoId ? (
                    <div className="thumb-copy-research-modal__detail">
                      <p>
                        <span className="thumb-ui-label">영상 제목</span>
                        {item.title}
                      </p>
                      {item.thumbnailLines.map((line, idx) => (
                        <p key={idx}>
                          <span className="thumb-ui-label">썸네일 {idx + 1}줄</span>
                          {line}
                        </p>
                      ))}
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="thumb-copy-research-modal__link"
                      >
                        YouTube에서 보기 ↗
                      </a>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="thumb-ui-hint thumb-copy-research-modal__empty">
            「유튜브 참고 수집」을 누르면 최근 1년 **한국어(한글) 롱폼(3분+)**·**고조회** 영상의 제목·썸네일 문구가
            여기에 표시됩니다. (중국어·일본어 드라마·쇼츠·3분 미만·저조회 제외)
          </p>
        )}
      </div>
    </div>
  )
}

"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import type { ShoppingProject } from "./project-actions"

/** 9단계 (진행 막대·단계 표시용). 예전 단계 id 는 같은 자리로 묶는다 */
const STEPS = [
  { id: "keywordAnalysis", label: "키워드 분석" },
  { id: "collect", label: "제품 서칭" },
  { id: "scriptJson", label: "대본" },
  { id: "voice", label: "AI 음성" },
  { id: "images", label: "AI 이미지" },
  { id: "videos", label: "AI 영상" },
  { id: "thumbnail", label: "썸네일" },
  { id: "preview", label: "AI 영상편집" },
  { id: "metadata", label: "유튜브 정보" },
] as const
const LEGACY: Record<string, string> = { product: "collect", script: "scriptJson", storyboard: "voice", video: "images", render: "videos" }
const stepIndex = (id?: string) => Math.max(0, STEPS.findIndex((s) => s.id === (LEGACY[id ?? ""] ?? id ?? "collect")))

const DAY = 86_400_000
/** 만든 지 7일이 지나면 자동 삭제된다 (project-actions purge) */
const daysLeft = (created: string) => Math.max(0, 7 - Math.floor((Date.now() - new Date(created).getTime()) / DAY))
function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return "방금 전"
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`
  return `${Math.floor(s / 86400)}일 전`
}
function coverOf(p: ShoppingProject): string | undefined {
  const d = p.data ?? {}
  return d.thumbnailUrl || d.imageUrls?.find(Boolean) || d.productImage || d.productImages?.find(Boolean) || undefined
}

export type CreateForm = {
  open: boolean
  setOpen: (v: boolean) => void
  name: string
  setName: (v: string) => void
  description: string
  setDescription: (v: string) => void
  quality: "standard" | "high"
  setQuality: (v: "standard" | "high") => void
  saving: boolean
  submit: () => void
}

/**
 * AI 쇼핑 숏폼 홈: 이어서 작업하기 + 프로젝트 목록 + 새 프로젝트 만들기.
 * 앱 전체 색 반전(light-remap)을 받지 않도록 light-keep 안에서 직접 색을 정한다.
 */
export default function AiShoppingHome({ projects, loading, onOpen, onDelete, onRename, create }: {
  projects: ShoppingProject[]
  loading: boolean
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => Promise<void>
  create: CreateForm
}) {
  const [q, setQ] = useState("")
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const list = useMemo(() => {
    const k = q.trim().toLowerCase()
    return k ? projects.filter((p) => p.name.toLowerCase().includes(k) || p.description?.toLowerCase().includes(k)) : projects
  }, [projects, q])
  const latest = !q && projects[0]?.data?.qualityMode !== "high" ? projects[0] : undefined
  const rest = latest ? list.filter((p) => p.id !== latest.id) : list
  const openCreate = () => { create.setName(""); create.setDescription(""); create.setQuality("standard"); create.setOpen(true) }

  return (
    <div className="light-keep relative min-h-screen bg-[#f5f6fa] text-[#0e1016]">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[460px] bg-[radial-gradient(900px_380px_at_15%_-10%,rgba(47,59,235,0.10),transparent_60%),radial-gradient(700px_360px_at_95%_0%,rgba(255,90,54,0.08),transparent_60%)]" />
      <div className="relative mx-auto max-w-[1180px] px-5 pb-20 pt-6 md:px-8">
        {/* 상단 */}
        <nav className="flex items-center justify-between">
          <Link href="/WingsAIStudioShotForm" className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-semibold text-[#5c6170] transition hover:text-[#0e1016] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2f3beb]">
            <span aria-hidden>←</span> 쇼트폼 홈
          </Link>
          <span className="text-xs font-semibold text-[#5c6170]">프로젝트는 만든 날부터 7일 동안 보관돼요</span>
        </nav>

        <header className="mt-8 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-[640px]">
            <h1 className="text-[40px] font-black leading-[1.08] tracking-[-0.035em] md:text-[52px]">
              쿠팡 상품 하나로<br />
              <span className="text-[#2f3beb]">쇼핑 숏폼</span>을 만들어요
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[#5c6170]">
              영상 소스가 없어도 괜찮아요. 상품 이미지와 리뷰로 대본·음성·AI 장면을 만들고, 편집까지 한 번에 끝내요.
            </p>
          </div>
          <button type="button" onClick={openCreate}
            className="group flex items-center gap-3 rounded-2xl bg-[#0e1016] py-3.5 pl-5 pr-4 text-[15px] font-bold text-white shadow-[0_18px_40px_-18px_rgba(14,16,22,0.8)] transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f3beb]">
            새 프로젝트
            <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg bg-[#2f3beb] text-lg leading-none transition group-hover:rotate-90">+</span>
          </button>
        </header>

        {/* 9단계 흐름 */}
        <ol className="mt-8 flex gap-1.5 overflow-x-auto pb-1" aria-label="제작 단계">
          {STEPS.map((s, i) => (
            <li key={s.id} className="flex shrink-0 items-center gap-1.5">
              <span className="flex items-center gap-2 rounded-full border border-[#e3e6ec] bg-white px-3 py-1.5 text-xs font-semibold text-[#3a3f4c]">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[#eef0fb] text-[10px] font-bold tabular-nums text-[#2f3beb]">{i + 1}</span>
                {s.label}
              </span>
              {i < STEPS.length - 1 && <span aria-hidden className="h-px w-3 bg-[#d5d8e1]" />}
            </li>
          ))}
        </ol>

        {/* 이어서 작업하기 */}
        {latest && !loading && (
          <section className="mt-10">
            <h2 className="text-sm font-bold text-[#5c6170]">이어서 작업하기</h2>
            <ContinueCard p={latest} onOpen={() => onOpen(latest.id)} />
          </section>
        )}

        {/* 목록 */}
        <section className="mt-10">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-bold text-[#5c6170]">내 프로젝트 <span className="tabular-nums">{projects.length}</span></h2>
            <label className="relative ml-auto w-full max-w-[320px]">
              <span className="sr-only">프로젝트 검색</span>
              <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aa0ad]">⌕</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름이나 메모로 찾기"
                className="h-10 w-full rounded-xl border border-[#e3e6ec] bg-white pl-9 pr-3 text-sm text-[#0e1016] outline-none transition placeholder:text-[#9aa0ad] focus:border-[#2f3beb] focus:ring-4 focus:ring-[#2f3beb]/10" />
            </label>
          </div>

          {loading ? (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => <li key={i} className="h-[300px] animate-pulse rounded-3xl bg-white" />)}
            </ul>
          ) : !projects.length ? (
            <div className="mt-4 flex flex-col items-center rounded-3xl border border-dashed border-[#d5d8e1] bg-white/60 px-6 py-16 text-center">
              <p className="text-lg font-bold">아직 만든 쇼핑 숏폼이 없어요</p>
              <p className="mt-1.5 text-sm text-[#5c6170]">쿠팡 상품 링크나 키워드만 있으면 시작할 수 있어요.</p>
              <button type="button" onClick={openCreate} className="mt-6 rounded-xl bg-[#2f3beb] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_-14px_rgba(47,59,235,0.7)] transition hover:bg-[#4350ff]">첫 프로젝트 만들기</button>
            </div>
          ) : !rest.length ? (
            <p className="mt-4 rounded-2xl bg-white px-4 py-6 text-center text-sm text-[#5c6170]">{q ? `"${q}"에 맞는 프로젝트가 없어요.` : "다른 프로젝트가 없어요."}</p>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((p) => (
                <li key={p.id}>
                  <ProjectCard p={p} menuOpen={menu === p.id} onMenu={(v) => setMenu(v ? p.id : null)}
                    editing={editing?.id === p.id ? editing.name : null}
                    onEdit={(name) => setEditing(name === null ? null : { id: p.id, name })}
                    onSaveName={async () => { if (editing?.name.trim()) { await onRename(p.id, editing.name.trim()); setEditing(null) } }}
                    onOpen={() => onOpen(p.id)} onDelete={() => { setMenu(null); onDelete(p.id) }} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {create.open && <CreateDialog create={create} />}
    </div>
  )
}

function Progress({ p, dark }: { p: ShoppingProject; dark?: boolean }) {
  const hq = p.data?.qualityMode === "high"
  const i = stepIndex(p.data?.activeStep)
  const done = new Set(p.data?.completedSteps ?? [])
  return hq ? (
    <span className={`text-xs font-semibold ${dark ? "text-white/70" : "text-[#5c6170]"}`}>고퀄리티 · 15초 아바타 영상</span>
  ) : (
    <div>
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className={dark ? "text-white" : "text-[#0e1016]"}>{STEPS[i]!.label}</span>
        <span className={`tabular-nums ${dark ? "text-white/60" : "text-[#9aa0ad]"}`}>{i + 1}/9</span>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden>
        {STEPS.map((s, k) => (
          <span key={s.id} className={`h-1 flex-1 rounded-full ${k < i || done.has(s.id) ? (dark ? "bg-white" : "bg-[#2f3beb]") : k === i ? (dark ? "bg-white/60" : "bg-[#2f3beb]/45") : dark ? "bg-white/15" : "bg-[#e3e6ec]"}`} />
        ))}
      </div>
    </div>
  )
}

function Cover({ p, className = "" }: { p: ShoppingProject; className?: string }) {
  const src = coverOf(p)
  const [bad, setBad] = useState(false)
  return src && !bad ? (
    <img src={src} alt="" loading="lazy" onError={() => setBad(true)} className={`object-cover ${className}`} />
  ) : (
    <div className={`grid place-items-center bg-[linear-gradient(135deg,#eef0fb,#fde9e3)] ${className}`}>
      <span className="text-3xl font-black text-[#2f3beb]/30">{p.name.slice(0, 1)}</span>
    </div>
  )
}

function ContinueCard({ p, onOpen }: { p: ShoppingProject; onOpen: () => void }) {
  const left = daysLeft(p.created_at)
  return (
    <button type="button" onClick={onOpen}
      className="group mt-3 grid w-full overflow-hidden rounded-[28px] bg-[#0e1016] text-left text-white shadow-[0_30px_60px_-30px_rgba(14,16,22,0.7)] transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2f3beb] md:grid-cols-[minmax(0,1fr)_260px]">
      <div className="flex flex-col justify-between gap-8 p-7 md:p-9">
        <div>
          <p className="text-xs font-semibold text-white/50">{ago(p.updated_at)} 수정 · {left > 0 ? `${left}일 뒤 자동 삭제` : "곧 자동 삭제"}</p>
          <p className="mt-2 text-[28px] font-black leading-tight tracking-[-0.02em]">{p.name}</p>
          {p.description && <p className="mt-1.5 line-clamp-1 text-sm text-white/55">{p.description}</p>}
        </div>
        <div className="max-w-[420px]">
          <Progress p={p} dark />
          <span className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#0e1016] transition group-hover:bg-[#eef0ff]">
            이어서 만들기 <span aria-hidden>→</span>
          </span>
        </div>
      </div>
      <div className="relative hidden md:block">
        <Cover p={p} className="absolute inset-0 h-full w-full" />
        <span aria-hidden className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#0e1016] to-transparent" />
      </div>
    </button>
  )
}

function ProjectCard({ p, menuOpen, onMenu, editing, onEdit, onSaveName, onOpen, onDelete }: {
  p: ShoppingProject; menuOpen: boolean; onMenu: (v: boolean) => void
  editing: string | null; onEdit: (name: string | null) => void; onSaveName: () => void
  onOpen: () => void; onDelete: () => void
}) {
  const left = daysLeft(p.created_at)
  const hq = p.data?.qualityMode === "high"
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-[#e3e6ec] bg-white transition hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-28px_rgba(14,16,22,0.35)]">
      <button type="button" onClick={onOpen} className="relative block aspect-[16/10] overflow-hidden bg-[#f1f3f7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2f3beb]" aria-label={`${p.name} 열기`}>
        <Cover p={p} className="h-full w-full transition duration-500 group-hover:scale-[1.04]" />
        <span className="absolute left-3 top-3 flex gap-1.5">
          {hq && <span className="rounded-full bg-[#0e1016]/85 px-2.5 py-1 text-[10px] font-bold text-[#d7ff5a] backdrop-blur">고퀄리티</span>}
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold backdrop-blur ${left <= 1 ? "bg-[#ff3b30] text-white" : "bg-white/85 text-[#3a3f4c]"}`}>D-{left}</span>
        </span>
      </button>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start gap-2">
          {editing !== null ? (
            <form className="flex flex-1 gap-1.5" onSubmit={(e) => { e.preventDefault(); onSaveName() }}>
              <input autoFocus value={editing} onChange={(e) => onEdit(e.target.value)} aria-label="프로젝트 이름"
                onKeyDown={(e) => { if (e.key === "Escape") onEdit(null) }}
                className="h-9 min-w-0 flex-1 rounded-lg border border-[#2f3beb] px-2.5 text-[15px] font-bold outline-none ring-4 ring-[#2f3beb]/10" />
              <button type="submit" className="rounded-lg bg-[#2f3beb] px-3 text-xs font-bold text-white">저장</button>
            </form>
          ) : (
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[17px] font-bold tracking-[-0.01em]">{p.name}</h3>
              <p className="mt-0.5 text-xs text-[#9aa0ad]">{ago(p.updated_at)} 수정</p>
            </div>
          )}
          {editing === null && (
            <div className="relative">
              <button type="button" aria-label="더보기" aria-expanded={menuOpen} onClick={() => onMenu(!menuOpen)}
                className="grid h-8 w-8 place-items-center rounded-lg text-lg leading-none text-[#9aa0ad] transition hover:bg-[#f1f3f7] hover:text-[#0e1016]">⋯</button>
              {menuOpen && (
                <>
                  <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => onMenu(false)} />
                  <div role="menu" className="absolute right-0 top-9 z-20 w-36 overflow-hidden rounded-xl border border-[#e3e6ec] bg-white py-1 shadow-[0_18px_40px_-16px_rgba(14,16,22,0.35)]">
                    <button role="menuitem" type="button" onClick={() => { onMenu(false); onEdit(p.name) }} className="block w-full px-3.5 py-2 text-left text-sm hover:bg-[#f5f6fa]">이름 바꾸기</button>
                    <button role="menuitem" type="button" onClick={onDelete} className="block w-full px-3.5 py-2 text-left text-sm text-[#e5372b] hover:bg-[#fff1f0]">삭제</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="mt-auto"><Progress p={p} /></div>
      </div>
    </article>
  )
}

function CreateDialog({ create }: { create: CreateForm }) {
  const close = () => create.setOpen(false)
  const types = [
    { id: "standard" as const, name: "AI 쇼핑 숏폼", badge: "9단계", desc: "키워드 분석부터 대본·음성·AI 장면·편집까지 단계별로 직접 다듬어요." },
    { id: "high" as const, name: "고퀄리티 아바타 영상", badge: "Seedance 2.5", desc: "제품 사진과 한국인 아바타로 15초 소개 영상을 한 번에 만들어요." },
  ]
  return (
    <div role="dialog" aria-modal="true" aria-label="새 프로젝트 만들기" className="fixed inset-0 z-[80] grid place-items-center bg-[#0e1016]/45 p-4 backdrop-blur-sm"
      onKeyDown={(e) => { if (e.key === "Escape") close() }}>
      <button type="button" aria-hidden tabIndex={-1} className="absolute inset-0 cursor-default" onClick={close} />
      <form className="relative w-full max-w-[560px] rounded-[28px] bg-white p-7 shadow-[0_40px_100px_-30px_rgba(14,16,22,0.6)]"
        onSubmit={(e) => { e.preventDefault(); if (create.name.trim() && !create.saving) create.submit() }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-[-0.02em]">새 프로젝트</h2>
            <p className="mt-1 text-sm text-[#5c6170]">만드는 방식을 고르고 이름을 정해 주세요.</p>
          </div>
          <button type="button" onClick={close} aria-label="닫기" className="grid h-9 w-9 place-items-center rounded-full text-[#9aa0ad] transition hover:bg-[#f1f3f7] hover:text-[#0e1016]">✕</button>
        </div>

        <fieldset className="mt-6 grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">만드는 방식</legend>
          {types.map((t) => {
            const on = create.quality === t.id
            return (
              <label key={t.id} className={`relative cursor-pointer rounded-2xl border-2 p-4 transition ${on ? "border-[#2f3beb] bg-[#f4f5ff]" : "border-[#e3e6ec] hover:border-[#c9cdd8]"}`}>
                <input type="radio" name="quality" className="sr-only" checked={on} onChange={() => create.setQuality(t.id)} />
                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${on ? "bg-[#2f3beb] text-white" : "bg-[#f1f3f7] text-[#5c6170]"}`}>{t.badge}</span>
                <span className="mt-2.5 block text-[15px] font-bold">{t.name}</span>
                <span className="mt-1 block text-xs leading-relaxed text-[#5c6170]">{t.desc}</span>
                {on && <span aria-hidden className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-[#2f3beb] text-[11px] font-bold text-white">✓</span>}
              </label>
            )
          })}
        </fieldset>

        <label className="mt-5 block">
          <span className="text-sm font-bold">프로젝트 이름</span>
          <input autoFocus value={create.name} onChange={(e) => create.setName(e.target.value)} placeholder="예: 회전식 사과 깎이"
            className="mt-2 h-12 w-full rounded-xl border border-[#e3e6ec] bg-[#f7f8fb] px-4 text-[15px] font-semibold outline-none transition placeholder:font-normal placeholder:text-[#9aa0ad] focus:border-[#2f3beb] focus:bg-white focus:ring-4 focus:ring-[#2f3beb]/10" />
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-bold">메모 <span className="font-normal text-[#9aa0ad]">(선택)</span></span>
          <textarea value={create.description} onChange={(e) => create.setDescription(e.target.value)} rows={2} placeholder="제품군이나 참고할 내용을 적어 두세요"
            className="mt-2 w-full resize-none rounded-xl border border-[#e3e6ec] bg-[#f7f8fb] px-4 py-3 text-sm outline-none transition placeholder:text-[#9aa0ad] focus:border-[#2f3beb] focus:bg-white focus:ring-4 focus:ring-[#2f3beb]/10" />
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={close} className="rounded-xl px-4 py-3 text-sm font-bold text-[#5c6170] transition hover:bg-[#f1f3f7]">취소</button>
          <button type="submit" disabled={!create.name.trim() || create.saving}
            className="rounded-xl bg-[#2f3beb] px-6 py-3 text-sm font-bold text-white shadow-[0_12px_30px_-14px_rgba(47,59,235,0.7)] transition hover:bg-[#4350ff] disabled:cursor-not-allowed disabled:opacity-40">
            {create.saving ? "만드는 중..." : "만들기"}
          </button>
        </div>
      </form>
    </div>
  )
}

"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowLeft, ExternalLink, Film } from "lucide-react"
import { Button } from "@/components/ui/button"
import { studio } from "../components/ShotFormStudioUI"
import { platformLabelKo } from "@/lib/product-search-links"
import { readMixSourcesFromSession, SHOTFORM_SESSION_RESTORED_EVENT, type MixSourceItem } from "@/lib/shotform-mix-source"

export function MixSourceView() {
  const [items, setItems] = useState<MixSourceItem[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const sync = () => {
      setItems(readMixSourcesFromSession())
      setReady(true)
    }
    sync()
    window.addEventListener(SHOTFORM_SESSION_RESTORED_EVENT, sync)
    return () => window.removeEventListener(SHOTFORM_SESSION_RESTORED_EVENT, sync)
  }, [])

  return (
    <div className="text-slate-100">
      <Button asChild variant="ghost" size="sm" className="mb-6 text-slate-400 hover:text-white">
        <Link href="/WingsAIStudioShotForm/product-search">
          <ArrowLeft className="mr-2 h-4 w-4" />
          제품 검색으로
        </Link>
      </Button>

      <h1 className="text-2xl font-bold text-white">믹스 소스</h1>
      <p className="mt-2 text-sm text-slate-400">
        제품 검색에서 추가한 영상입니다. 링크를 확인한 뒤 <span className="font-medium text-cyan-200/90">AI 쇼핑 숏폼</span>으로
        넘어가 영상 분석·합성을 시작하세요.
      </p>

      {!ready ? (
        <div className="mt-10 h-32 animate-pulse rounded-xl border border-slate-800 bg-slate-900/40" />
      ) : items.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 py-16 text-center">
          <Film className="mb-3 h-12 w-12 text-slate-600" />
          <p className="text-slate-300">추가 영상이 없습니다.</p>
          <p className="mt-1 text-sm text-slate-500">
            제품 검색에서 영상을 선택한 뒤 하단의 &quot;다음 단계&quot;로 AI 쇼핑 숏폼으로 이동하세요.
          </p>
          <Button asChild className="mt-6 bg-cyan-600 text-white hover:bg-cyan-500">
            <Link href="/WingsAIStudioShotForm/product-search">제품 검색 열기</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((it, i) => (
            <li
              key={`${it.url}-${i}`}
              className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500">{platformLabelKo(it.platform)}</p>
                <p className="line-clamp-2 font-medium text-white">{it.title}</p>
                {it.author ? <p className="mt-0.5 truncate text-xs text-slate-500">{it.author}</p> : null}
              </div>
              <Button asChild size="sm" variant="secondary" className="shrink-0 border-slate-600 bg-slate-800 text-slate-100">
                <a href={it.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  열기
                </a>
              </Button>
            </li>
          ))}
        </ul>
      )}

      {ready && items.length > 0 ? (
        <div className="mt-10 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-400">
            다음 단계는 <span className="font-medium text-white">AI 쇼핑 숏폼</span>에서 레퍼런스 분석·믹스 파이프라인을
            진행합니다.
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-gradient-to-r from-pink-500 to-violet-600 text-white hover:brightness-110">
              <Link href="/WingsAIStudioShotForm/shoppingshotform">AI 쇼핑 숏폼으로 (다음 단계)</Link>
            </Button>
            <Button asChild variant="ghost" className={studio.btnPrimary}>
              <Link href="/WingsAIStudioShotForm/shopping">쇼핑 숏폼에서 이어하기</Link>
            </Button>
            <Button asChild variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800">
              <Link href="/WingsAIStudioShotForm/shorts">쇼츠 제작으로</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

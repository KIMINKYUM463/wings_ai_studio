"use client"

import { useState } from "react"
import { Play } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

/** 기능별 가이드 영상 목록. 파일은 public/shotform/guides/<id>.mp4 — ready 가 false 면 "준비 중"으로 보임 */
// 썰·리믹스 가이드는 v2(로컬 전용) 화면으로 녹화됨 → 배포판에서는 숨김
const ON_VERCEL = process.env.NEXT_PUBLIC_IS_VERCEL === "1"
const LOCAL_ONLY_GUIDES = ["story-shopping", "remix-shopping"]

const ALL_GUIDES: { id: string; title: string; desc: string; ready: boolean; src?: string }[] = [
  { id: "api-key", title: "API 키 발급", desc: "필수 3개 · 선택 4개 키 만들기", ready: true, src: "/shotform/api-key-guide.mp4" },
  { id: "ai-shopping", title: "AI 쇼핑 숏폼", desc: "쿠팡 상품 하나로 9단계 완성", ready: true },
  { id: "story-shopping", title: "AI 썰쇼핑숏폼", desc: "잘 나간 쇼츠로 썰 대본·편집", ready: true },
  { id: "remix-shopping", title: "AI 리믹스 쇼핑숏폼", desc: "쇼츠 주소로 같은 상품 영상 리믹스", ready: true },
  { id: "animal-shopping", title: "AI 동물 쇼핑 숏폼", desc: "동물 캐릭터가 상품 소개", ready: true },
  { id: "info-shopping", title: "AI 카드뉴스 쇼핑숏폼", desc: "꿀팁·리뷰 카드뉴스 쇼츠", ready: true },
  { id: "travel-shopping", title: "AI 여행쇼핑숏폼", desc: "숙소 링크 한 줄로 여행 쇼츠", ready: true },
]
export const SHOTFORM_GUIDES = ALL_GUIDES.filter((g) => !(ON_VERCEL && LOCAL_ONLY_GUIDES.includes(g.id)))

export default function ShotFormGuideGallery({ triggerClassName, label = "가이드 영상", iconClassName = "h-3.5 w-3.5", tour }: { triggerClassName: string; label?: string; iconClassName?: string; tour?: string }) {
  const [current, setCurrent] = useState(SHOTFORM_GUIDES.find((g) => g.ready)!.id)
  const g = SHOTFORM_GUIDES.find((x) => x.id === current)!
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" data-tour={tour} className={triggerClassName}>
          <Play className={iconClassName} />
          {label}
        </button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-6xl border-[#e5e9f0] bg-[#fff] p-4 text-[#111827] sm:max-w-6xl sm:p-5">
        <DialogHeader>
          <DialogTitle>가이드 영상</DialogTitle>
          <DialogDescription className="text-[#6b7280]">기능을 골라 보세요. 영상 속 화살표와 자막을 따라 하면 돼요.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <ul className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible" aria-label="가이드 목록">
            {SHOTFORM_GUIDES.map((x) => {
              const on = x.id === current
              return (
                <li key={x.id} className="shrink-0">
                  <button
                    type="button"
                    disabled={!x.ready}
                    aria-current={on}
                    onClick={() => setCurrent(x.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${on ? "border-[#14213d] bg-[#14213d] text-[#fff]" : "border-[#e1e6ee] bg-[#fff] text-[#111827] hover:bg-[#f7f9fc]"} disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <span className="block text-[13px] font-semibold">{x.title}</span>
                    <span className={`block text-[12px] ${on ? "text-[#cbd5e1]" : "text-[#6b7280]"}`}>{x.ready ? x.desc : "준비 중"}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {/* key 로 바꿔 끼워 다른 영상을 고르면 처음부터 재생 */}
          <video key={g.id} src={g.src ?? `/shotform/guides/${g.id}.mp4`} controls autoPlay playsInline preload="metadata" className="aspect-video w-full rounded-lg bg-[#000]" />
        </div>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // 더블 우클릭으로 admin 페이지 접근
    let rightClickCount = 0
    let rightClickTimer: NodeJS.Timeout | null = null

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      rightClickCount++

      if (rightClickCount === 1) {
        rightClickTimer = setTimeout(() => {
          rightClickCount = 0
        }, 500)
      } else if (rightClickCount === 2) {
        if (rightClickTimer) clearTimeout(rightClickTimer)
        rightClickCount = 0
        router.push("/admin")
      }
    }

    document.addEventListener("contextmenu", handleContextMenu)

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu)
      if (rightClickTimer) clearTimeout(rightClickTimer)
    }
  }, [router])

  return (
    <div className="min-h-screen bg-[oklch(0.13_0_0)] text-[oklch(0.98_0_0)] font-sans">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-[oklch(0.28_0_0)] bg-[oklch(0.13_0_0)]/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[oklch(0.98_0_0)]">
              <span className="text-xl font-bold text-[oklch(0.13_0_0)]">B</span>
            </div>
            <span className="text-lg font-semibold">
              부스텍<span className="text-[oklch(0.98_0_0)]">AI</span>
            </span>
          </Link>

          {/* Navigation */}
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#categories" className="text-sm text-[oklch(0.65_0_0)] hover:text-[oklch(0.98_0_0)] transition-colors">
              카테고리
            </a>
            <a href="#pricing" className="text-sm text-[oklch(0.65_0_0)] hover:text-[oklch(0.98_0_0)] transition-colors">
              요금제
            </a>
            <a href="#" className="text-sm text-[oklch(0.65_0_0)] hover:text-[oklch(0.98_0_0)] transition-colors">
              문서
            </a>
          </nav>

          {/* Auth Buttons */}
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:inline-flex px-4 py-2 text-sm rounded-md hover:bg-[oklch(0.18_0_0)] transition-colors">
              로그인
            </Link>
            <Link href="/wingsAIStudio" className="inline-flex px-4 py-2 text-sm rounded-md bg-[oklch(0.98_0_0)] text-[oklch(0.13_0_0)] hover:opacity-90 transition-opacity">
              시작하기
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="flex min-h-[70vh] flex-col items-center justify-center px-6 pt-24 text-center">
          <p className="mb-4 text-sm font-medium text-[oklch(0.65_0_0)]">부스텍AI로 시작하는 부업</p>
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl">
            콘텐츠 생성을 위한<br />
            가장 빠른 플랫폼
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[oklch(0.65_0_0)]">
            유튜브 스크립트, 블로그 글, 이커머스 상품 설명까지. AI가 당신의 부업을 도와드립니다.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/wingsAIStudio" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-md bg-[oklch(0.98_0_0)] text-[oklch(0.13_0_0)] hover:opacity-90 transition-opacity">
              무료로 시작하기
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <a href="#pricing" className="px-6 py-3 text-sm font-medium rounded-md border border-[oklch(0.28_0_0)] hover:bg-[oklch(0.18_0_0)] transition-colors">
              요금제 보기
            </a>
          </div>
        </section>

        {/* Category Section */}
        <section id="categories" className="mx-auto max-w-7xl px-6 py-24">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">프로그램 목록</h2>
            <p className="mt-4 text-[oklch(0.65_0_0)]">수강생에게 제공되는 프로그램을 확인하세요</p>
          </div>

          <div className="min-h-[400px] rounded-2xl border-2 border-dashed border-[oklch(0.28_0_0)] bg-[oklch(0.18_0_0)]/50 p-12">
            <div className="flex h-full items-center justify-center">
              <p className="text-center text-[oklch(0.65_0_0)]">강사별 프로그램이 여기에 표시됩니다</p>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="mx-auto max-w-7xl px-6 py-24">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">요금제</h2>
            <p className="mt-4 text-[oklch(0.65_0_0)]">필요에 맞는 플랜을 선택하세요</p>
          </div>

          <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
            {/* Free Plan */}
            <div className="relative flex flex-col rounded-2xl border border-[oklch(0.28_0_0)] bg-[oklch(0.18_0_0)] p-8">
              <span className="absolute -top-3 left-6 rounded-full bg-[oklch(0.98_0_0)] px-3 py-1 text-xs font-medium text-[oklch(0.13_0_0)]">
                수강생 전용
              </span>
              <h3 className="text-lg font-semibold">Free</h3>
              <p className="mt-2 text-sm text-[oklch(0.65_0_0)]">수강생 전용 무료 플랜</p>
              <div className="mt-6">
                <span className="text-4xl font-bold">₩0</span>
                <span className="text-sm text-[oklch(0.65_0_0)]">/월</span>
              </div>
              <ul className="mt-8 flex-1 space-y-3">
                <li className="flex items-center gap-3 text-sm">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  월 10회 생성
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  기본 템플릿
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  커뮤니티 지원
                </li>
              </ul>
              <button className="mt-8 w-full px-4 py-2 text-sm font-medium rounded-md border border-[oklch(0.28_0_0)] hover:bg-[oklch(0.18_0_0)] transition-colors">
                수강생 인증하기
              </button>
            </div>

            {/* Pro Plan */}
            <div className="relative flex flex-col rounded-2xl border border-[oklch(0.98_0_0)] bg-[oklch(0.98_0_0)] text-[oklch(0.13_0_0)] p-8">
              <h3 className="text-lg font-semibold">Pro</h3>
              <p className="mt-2 text-sm opacity-70">모든 기능을 무제한으로</p>
              <div className="mt-6">
                <span className="text-4xl font-bold">₩50,000</span>
                <span className="text-sm opacity-70">/월</span>
              </div>
              <ul className="mt-8 flex-1 space-y-3">
                <li className="flex items-center gap-3 text-sm">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  무제한 생성
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  프리미엄 템플릿
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  우선 지원
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  API 접근
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  새로운 기능 우선 제공
                </li>
              </ul>
              <button className="mt-8 w-full px-4 py-2 text-sm font-medium rounded-md bg-[oklch(0.13_0_0)] text-[oklch(0.98_0_0)] hover:opacity-90 transition-opacity">
                Pro 시작하기
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[oklch(0.28_0_0)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 md:flex-row">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[oklch(0.98_0_0)]">
                <span className="text-xl font-bold text-[oklch(0.13_0_0)]">B</span>
              </div>
              <span className="text-lg font-semibold">
                부스텍<span className="text-[oklch(0.98_0_0)]">AI</span>
              </span>
            </div>
            <span className="text-sm text-[oklch(0.65_0_0)]">© 2025</span>
          </div>
          <nav className="flex gap-6">
            <a href="#" className="text-sm text-[oklch(0.65_0_0)] hover:text-[oklch(0.98_0_0)]">이용약관</a>
            <a href="#" className="text-sm text-[oklch(0.65_0_0)] hover:text-[oklch(0.98_0_0)]">개인정보처리방침</a>
            <a href="#" className="text-sm text-[oklch(0.65_0_0)] hover:text-[oklch(0.98_0_0)]">문의</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}

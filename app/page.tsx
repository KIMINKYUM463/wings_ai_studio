'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Program {
  id: string
  program_name: string
  program_path: string
  program_description: string | null
}

export default function HomePage() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [programs, setPrograms] = useState<Program[]>([])
  const [programsLoading, setProgramsLoading] = useState(true)
  const [hasInstructor, setHasInstructor] = useState<boolean | null>(null)

  // 로그인 상태 확인
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const response = await fetch('/api/kakao/user')
        if (response.ok) {
          const data = await response.json()
          if (data.loggedIn) {
            setIsLoggedIn(true)
            setUser(data.user)
          }
        }
      } catch (error) {
        console.error('로그인 상태 확인 실패:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkLoginStatus()

    // URL 파라미터에서 로그인 성공/실패 메시지 확인
    const urlParams = new URLSearchParams(window.location.search)
    const kakaoLogin = urlParams.get('kakao_login')
    const kakaoError = urlParams.get('kakao_error')

    if (kakaoLogin === 'success') {
      checkLoginStatus()
      // URL에서 파라미터 제거
      window.history.replaceState({}, '', '/')
    }

    if (kakaoError) {
      alert(`카카오 로그인 오류: ${kakaoError}`)
      window.history.replaceState({}, '', '/')
    }
  }, [])

  // 강사별 프로그램 목록 로드
  useEffect(() => {
    const loadPrograms = async () => {
      try {
        if (isLoggedIn) {
          const response = await fetch('/api/user/programs')
          if (response.ok) {
            const data = await response.json()
            const instructorPrograms = data.programs || []
            // youmaker 제외 (필터링)
            const filteredPrograms = instructorPrograms.filter((p: Program) => p.id !== 'youmaker' && p.program_path !== '/youmaker')
            setPrograms(filteredPrograms)
            setHasInstructor(data.hasInstructor ?? null)
          } else {
            setPrograms([])
            setHasInstructor(null)
          }
        } else {
          setPrograms([])
          setHasInstructor(null)
        }
      } catch (error) {
        console.error('프로그램 목록 로드 실패:', error)
        setPrograms([])
        setHasInstructor(null)
      } finally {
        setProgramsLoading(false)
      }
    }

    loadPrograms()
  }, [isLoggedIn])

  // 카카오 로그인 시작
  const handleKakaoLogin = () => {
    window.location.href = '/api/kakao/auth'
  }

  // 로그아웃
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/kakao/logout', {
        method: 'POST',
      })
      if (response.ok) {
        setIsLoggedIn(false)
        setUser(null)
        router.refresh()
      }
    } catch (error) {
      console.error('로그아웃 실패:', error)
      alert('로그아웃에 실패했습니다.')
    }
  }

  useEffect(() => {
    // Admin page trigger - double right click
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
        window.location.href = '/admin'
      }
    }

    document.addEventListener('contextmenu', handleContextMenu)
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
      if (rightClickTimer) clearTimeout(rightClickTimer)
    }
  }, [])

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          :root {
            --background: oklch(0.13 0 0);
            --foreground: oklch(0.98 0 0);
            --card: oklch(0.18 0 0);
            --muted-foreground: oklch(0.65 0 0);
            --border: oklch(0.28 0 0);
            --primary: oklch(0.98 0 0);
            --primary-foreground: oklch(0.13 0 0);
          }
          
          body {
            background-color: oklch(0.13 0 0) !important;
            color: oklch(0.98 0 0) !important;
            font-family: system-ui, -apple-system, sans-serif !important;
          }
          
          .bg-background { background-color: var(--background); }
          .bg-card { background-color: var(--card); }
          .bg-primary { background-color: var(--primary); }
          .text-foreground { color: var(--foreground); }
          .text-muted-foreground { color: var(--muted-foreground); }
          .text-primary-foreground { color: var(--primary-foreground); }
          .border-border { border-color: var(--border); }
          
          .backdrop-blur-sm {
            backdrop-filter: blur(8px);
          }
        `
      }} />
      <script src="https://cdn.tailwindcss.com"></script>
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <span className="text-xl font-bold text-primary-foreground">B</span>
            </div>
            <span className="text-lg font-semibold">
              부스텍<span className="text-primary">AI</span>
            </span>
          </a>
          {/* Navigation */}
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#categories" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              카테고리
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              요금제
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              문서
            </a>
          </nav>
          {/* Auth Buttons */}
          <div className="flex items-center gap-3">
            {isLoading ? (
              <div className="px-4 py-2 text-sm text-muted-foreground">로딩 중...</div>
            ) : isLoggedIn ? (
              <>
                <div className="flex items-center gap-3 px-4 py-2 text-sm">
                  {(user?.profileImage || user?.thumbnailImage) && (
                    <img 
                      src={user?.profileImage || user?.thumbnailImage} 
                      alt={user.nickname || '프로필'} 
                      className="w-10 h-10 rounded-full border-2 border-border"
                    />
                  )}
                  <span className="text-foreground font-medium">{user?.nickname || '사용자'}</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm rounded-md hover:bg-card transition-colors"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={handleKakaoLogin}
                  className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-[#FEE500] text-[#000000] hover:opacity-90 transition-opacity font-medium"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M9 0C4.03 0 0 3.58 0 8c0 2.88 1.89 5.32 4.5 6.27L3.18 18l4.05-2.22c1.08.3 2.22.46 3.4.46 4.97 0 9-3.58 9-8s-4.03-8-9-8z" fill="currentColor"/>
                  </svg>
                  카카오 로그인
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      <main>
        {/* Hero Section */}
        <section className="flex min-h-[70vh] flex-col items-center justify-center px-6 pt-24 text-center">
          <p className="mb-4 text-sm font-medium text-muted-foreground">부스텍AI로 시작하는 부업</p>
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl">
            콘텐츠 생성을 위한<br />
            가장 빠른 플랫폼
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            유튜브 스크립트, 블로그 글, 이커머스 상품 설명까지. AI가 당신의 부업을 도와드립니다.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a href="/signup" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
              무료로 시작하기
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </a>
            <a href="#pricing" className="px-6 py-3 text-sm font-medium rounded-md border border-border hover:bg-card transition-colors">
              요금제 보기
            </a>
          </div>
        </section>
        {/* Category Section */}
        <section id="categories" className="mx-auto max-w-7xl px-6 py-24">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">프로그램 목록</h2>
            <p className="mt-4 text-muted-foreground">수강생에게 제공되는 프로그램을 확인하세요</p>
          </div>
          <div className="min-h-[400px] rounded-2xl border-2 border-dashed border-border bg-card/50 p-12">
            {programsLoading ? (
              <div className="flex h-full flex-col items-center justify-center gap-6">
                <p className="text-center text-muted-foreground">프로그램 목록을 불러오는 중...</p>
              </div>
            ) : programs.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-6">
                <p className="text-center text-muted-foreground">
                  {isLoggedIn 
                    ? '강사가 지정되지 않았거나 사용 가능한 프로그램이 없습니다.' 
                    : '로그인 후 강사별 프로그램을 확인할 수 있습니다.'}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {programs.map((program) => (
                  <a
                    key={program.id}
                    href={program.program_path}
                    className="group flex flex-col rounded-lg border border-border bg-card p-6 hover:border-primary transition-colors"
                  >
                    <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                      {program.program_name}
                    </h3>
                    {program.program_description && (
                      <p className="text-sm text-muted-foreground mb-4 flex-1">
                        {program.program_description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <span>바로가기</span>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>
        {/* Pricing Section */}
        <section id="pricing" className="mx-auto max-w-7xl px-6 py-24">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">요금제</h2>
            <p className="mt-4 text-muted-foreground">필요에 맞는 플랜을 선택하세요</p>
          </div>
          <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
            {/* Free Plan */}
            <div className="relative flex flex-col rounded-2xl border border-border bg-card p-8">
              <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                수강생 전용
              </span>
              <h3 className="text-lg font-semibold">Free</h3>
              <p className="mt-2 text-sm text-muted-foreground">수강생 전용 무료 플랜</p>
              <div className="mt-6">
                <span className="text-4xl font-bold">₩0</span>
                <span className="text-sm text-muted-foreground">/월</span>
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
              <button className="mt-8 w-full px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-card transition-colors">
                수강생 인증하기
              </button>
            </div>
            {/* Pro Plan */}
            <div className="relative flex flex-col rounded-2xl border border-foreground bg-foreground text-background p-8">
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
              <button className="mt-8 w-full px-4 py-2 text-sm font-medium rounded-md bg-background text-foreground hover:opacity-90 transition-opacity">
                Pro 시작하기
              </button>
            </div>
          </div>
        </section>
      </main>
      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 md:flex-row">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <span className="text-xl font-bold text-primary-foreground">B</span>
              </div>
              <span className="text-lg font-semibold">
                부스텍<span className="text-primary">AI</span>
              </span>
            </div>
            <span className="text-sm text-muted-foreground">© 2025</span>
          </div>
          <nav className="flex gap-6">
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground">이용약관</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground">개인정보처리방침</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground">문의</a>
          </nav>
        </div>
      </footer>
    </>
  )
}

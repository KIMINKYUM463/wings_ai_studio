'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import './wings-home.css'

interface Program {
  id: string
  program_name: string
  program_path: string
  program_description: string | null
}

function programLabel(program: Program): {
  title: string
  blurb: string
  tag: string
  kind: 'longform' | 'shortform' | 'default'
} {
  const path = program.program_path.toLowerCase()
  const id = program.id.toLowerCase()

  if (path.includes('shotform') || id.includes('shortform') || id.includes('shotform')) {
    return {
      title: 'ShortformAIStudio',
      blurb: program.program_description || '숏폼 짜집기 · 자막 · 썸네일까지 한 번에',
      tag: '숏폼',
      kind: 'shortform',
    }
  }
  if (path.includes('wingsaistudio') || id.includes('wingsaistudio')) {
    return {
      title: 'LongformAIStudio',
      blurb: program.program_description || '쇼츠부터 롱폼까지 유튜브 제작 워크플로',
      tag: '롱폼',
      kind: 'longform',
    }
  }
  return {
    title: program.program_name,
    blurb: program.program_description || '유튜브 전문 프로그램',
    tag: '유튜브',
    kind: 'default',
  }
}

function ProgramGlyph({ kind }: { kind: 'longform' | 'shortform' | 'default' }) {
  return (
    <span className={`wings-glyph wings-glyph-${kind}`}>
      <span className="wings-glyph-orbit" aria-hidden>
        <i /><i /><i /><i />
      </span>
      <span className="wings-glyph-core">
        {kind === 'shortform' ? (
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="7" y="3" width="10" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
            <path
              className="wings-glyph-lines"
              d="M10 8.5h4M10 12h4M10 15.5h2.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        ) : kind === 'longform' ? (
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3" y="6" width="18" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
            <path className="wings-glyph-play" d="M10 9.5l5 2.5-5 2.5V9.5z" fill="currentColor" />
          </svg>
        ) : (
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 8.5v7M8.5 12h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        )}
      </span>
    </span>
  )
}

function KakaoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M9 0C4.03 0 0 3.58 0 8c0 2.88 1.89 5.32 4.5 6.27L3.18 18l4.05-2.22c1.08.3 2.22.46 3.4.46 4.97 0 9-3.58 9-8s-4.03-8-9-8z"
        fill="currentColor"
      />
    </svg>
  )
}

const AI_PARTICLES = [
  { side: 'from-left', top: '28%', delay: '0s', dur: '2.4s', travel: '210px' },
  { side: 'from-left', top: '48%', delay: '0.5s', dur: '2.8s', travel: '210px' },
  { side: 'from-left', top: '68%', delay: '1.1s', dur: '2.2s', travel: '210px' },
  { side: 'from-right', top: '32%', delay: '0.3s', dur: '2.5s', travel: '-210px' },
  { side: 'from-right', top: '52%', delay: '0.9s', dur: '2.7s', travel: '-210px' },
  { side: 'from-right', top: '72%', delay: '1.4s', dur: '2.3s', travel: '-210px' },
]

const AI_BITS = [
  { text: '01001101', left: '8%', delay: '0s' },
  { text: 'FRAME·48', left: '28%', top: '58%', delay: '1.2s' },
  { text: 'TTS·SYNC', left: '52%', top: '22%', delay: '2.1s' },
  { text: 'CLIP·OK', left: '72%', top: '62%', delay: '0.7s' },
]

export default function HomePage() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [programs, setPrograms] = useState<Program[]>([])
  const [programsLoading, setProgramsLoading] = useState(true)
  const [programsMessage, setProgramsMessage] = useState<string | null>(null)
  const [isApproved, setIsApproved] = useState<boolean | null>(null)

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

    const urlParams = new URLSearchParams(window.location.search)
    const kakaoLogin = urlParams.get('kakao_login')
    const kakaoError = urlParams.get('kakao_error')

    if (kakaoLogin === 'success') {
      checkLoginStatus()
      window.history.replaceState({}, '', '/')
    }

    if (kakaoError) {
      alert(`카카오 로그인 오류: ${kakaoError}`)
      window.history.replaceState({}, '', '/')
    }
  }, [])

  useEffect(() => {
    const loadPrograms = async () => {
      try {
        if (isLoggedIn) {
          const response = await fetch('/api/user/programs')
          if (response.ok) {
            const data = await response.json()
            const instructorPrograms = data.programs || []
            const filteredPrograms = instructorPrograms.filter(
              (p: Program) => p.id !== 'youmaker' && p.program_path !== '/youmaker'
            )
            setPrograms(filteredPrograms)
            setIsApproved(Boolean(data.approved))
            setProgramsMessage(data.message || null)
          } else {
            setPrograms([])
            setIsApproved(false)
            setProgramsMessage(null)
          }
        } else {
          setPrograms([])
          setIsApproved(null)
          setProgramsMessage(null)
        }
      } catch (error) {
        console.error('프로그램 목록 로드 실패:', error)
        setPrograms([])
        setIsApproved(false)
        setProgramsMessage(null)
      } finally {
        setProgramsLoading(false)
      }
    }

    loadPrograms()
  }, [isLoggedIn])

  const handleKakaoLogin = () => {
    window.location.href = '/api/kakao/auth'
  }

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/kakao/logout', { method: 'POST' })
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
    let rightClickCount = 0
    let rightClickTimer: ReturnType<typeof setTimeout> | null = null

    const isTopRightCorner = (e: MouseEvent) => {
      const nearRight = e.clientX >= window.innerWidth - 72
      const nearTop = e.clientY <= 72
      return nearRight && nearTop
    }

    const handleContextMenu = (e: MouseEvent) => {
      if (!isTopRightCorner(e)) return

      e.preventDefault()
      rightClickCount++

      if (rightClickCount === 1) {
        rightClickTimer = setTimeout(() => {
          rightClickCount = 0
        }, 600)
      } else if (rightClickCount >= 2) {
        if (rightClickTimer) clearTimeout(rightClickTimer)
        rightClickCount = 0
        const password = window.prompt('관리자 비밀번호를 입력하세요')
        if (password === '6168') {
          try {
            sessionStorage.setItem('wings_admin_ok', '1')
          } catch {
            /* ignore */
          }
          window.location.href = '/admin'
        } else if (password != null) {
          alert('비밀번호가 올바르지 않습니다.')
        }
      }
    }

    document.addEventListener('contextmenu', handleContextMenu)
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
      if (rightClickTimer) clearTimeout(rightClickTimer)
    }
  }, [])

  return (
    <div className="wings-home">
      <header className="wh-header">
        <div className="wh-header-inner">
          <a href="/" className="wh-brand">
            <span className="wh-brand-word">wings</span>
            <span className="wh-brand-ai">AI</span>
          </a>

          <div className="wh-header-actions">
            {isLoading ? (
              <span className="wh-note">…</span>
            ) : isLoggedIn ? (
              <>
                <div className="wh-user">
                  {(user?.profileImage || user?.thumbnailImage) && (
                    <img
                      src={user?.profileImage || user?.thumbnailImage}
                      alt=""
                      className="wh-avatar"
                    />
                  )}
                  <span className="wh-user-name">{user?.nickname || '사용자'}</span>
                </div>
                <button type="button" onClick={handleLogout} className="wh-text-btn">
                  로그아웃
                </button>
              </>
            ) : (
              <button type="button" onClick={handleKakaoLogin} className="wh-kakao-btn">
                <KakaoIcon />
                카카오 로그인
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="wh-main">
        <div className="wh-hero wings-fade-up">
          <p className="wh-eyebrow">윙스 AI</p>
          <h1 className="wh-title">프로그램</h1>
        </div>

        {programsLoading ? (
          <p className="wh-note wings-fade-up wings-fade-up-delay-1">불러오는 중…</p>
        ) : !isLoggedIn ? (
          <div className="wh-panel wings-fade-up wings-fade-up-delay-1">
            <p className="wh-panel-text">로그인하면 이용 가능한 프로그램이 표시됩니다.</p>
            <button type="button" onClick={handleKakaoLogin} className="wh-kakao-btn wh-kakao-btn--lg">
              <KakaoIcon />
              카카오로 시작하기
            </button>
          </div>
        ) : programs.length === 0 ? (
          <div className="wh-panel wings-fade-up wings-fade-up-delay-1">
            <p className="wh-panel-text">
              사용 가능한 프로그램이 없습니다.
              {isApproved === false
                ? ' 관리자 승인 후 롱폼·숏폼을 이용할 수 있습니다.'
                : programsMessage
                  ? ` ${programsMessage}`
                  : ''}
            </p>
          </div>
        ) : (
          <ul className="wings-program-grid">
            {programs.map((program, index) => {
              const label = programLabel(program)
              return (
                <li
                  key={program.id}
                  className={`wings-fade-up wings-fade-up-delay-${Math.min(index + 1, 3)}`}
                >
                  <a
                    href={program.program_path}
                    className="wings-circle-pick"
                    aria-label={`${label.title} 열기`}
                  >
                    <span className="wings-circle">
                      <span className="wings-circle-ring" />
                      <span className="wings-circle-ring-inner" />
                      <ProgramGlyph kind={label.kind} />
                    </span>
                    <span className="wings-circle-meta">
                      <span className="wings-circle-tag">{label.tag}</span>
                      <span className="wings-circle-title">{label.title}</span>
                      <span className="wings-circle-blurb">{label.blurb}</span>
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        )}

        <div className="wings-ai-collect wings-fade-up wings-fade-up-delay-3" aria-hidden>
          <div className="wings-ai-collect-label">
            <span className="wings-ai-dot" />
            AI DATA COLLECTING
          </div>
          <div className="wings-ai-stage">
            <div className="wings-ai-scan" />
            <div className="wings-ai-core" />
            <div className="wings-ai-ring wings-ai-ring-a" />
            <div className="wings-ai-ring wings-ai-ring-b" />

            {AI_PARTICLES.map((p, i) => (
              <span
                key={i}
                className={`wings-ai-particle ${p.side}`}
                style={
                  {
                    top: p.top,
                    animationDelay: p.delay,
                    animationDuration: p.dur,
                    '--travel': p.travel,
                  } as CSSProperties
                }
              />
            ))}

            {AI_BITS.map((b) => (
              <span
                key={b.text}
                className="wings-ai-bit"
                style={{ left: b.left, top: b.top, animationDelay: b.delay }}
              >
                {b.text}
              </span>
            ))}
          </div>
          <p className="wings-ai-status">
            <strong>윙스 AI</strong>가 유튜브 제작 데이터를 수집·분석 중입니다
          </p>
        </div>
      </main>
    </div>
  )
}

'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'

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
    <div className="wings-home min-h-screen text-[var(--w-fg)]">
      <style dangerouslySetInnerHTML={{
        __html: `
          .wings-home {
            --w-bg: #0a0b0d;
            --w-fg: #f4f1ea;
            --w-muted: #9a958c;
            --w-line: rgba(244, 241, 234, 0.12);
            --w-accent: #e8c547;
            --w-surface: rgba(244, 241, 234, 0.04);
            --w-surface-hover: rgba(244, 241, 234, 0.08);
            background:
              radial-gradient(ellipse 80% 50% at 50% -20%, rgba(232, 197, 71, 0.14), transparent 55%),
              radial-gradient(ellipse 60% 40% at 100% 0%, rgba(80, 140, 160, 0.08), transparent 45%),
              var(--w-bg);
            font-family: var(--font-geist-sans), "Pretendard", "Apple SD Gothic Neo", sans-serif;
          }
          .wings-home a { text-decoration: none; color: inherit; }
          @keyframes wings-fade-up {
            from { opacity: 0; transform: translateY(16px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes wings-ring-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes wings-soft-pulse {
            0%, 100% { opacity: 0.35; }
            50% { opacity: 0.7; }
          }
          .wings-fade-up {
            animation: wings-fade-up 0.65s cubic-bezier(0.22, 1, 0.36, 1) both;
          }
          .wings-fade-up-delay-1 { animation-delay: 0.1s; }
          .wings-fade-up-delay-2 { animation-delay: 0.2s; }
          .wings-fade-up-delay-3 { animation-delay: 0.3s; }
          .wings-program-grid {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            align-items: flex-start;
            gap: clamp(36px, 7vw, 88px);
            list-style: none;
            margin: 32px 0 0;
            padding: 0;
          }
          .wings-circle-pick {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 22px;
            width: min(300px, 46vw);
            text-align: center;
            cursor: pointer;
            background: none;
            border: none;
            padding: 0;
            color: inherit;
          }
          .wings-circle {
            position: relative;
            width: clamp(180px, 34vw, 240px);
            height: clamp(180px, 34vw, 240px);
            border-radius: 50%;
            display: grid;
            place-items: center;
            color: var(--w-fg);
            border: 1px solid rgba(244,241,234,0.16);
            background:
              radial-gradient(circle at 35% 28%, rgba(255,255,255,0.1), transparent 42%),
              linear-gradient(160deg, rgba(244,241,234,0.07), rgba(244,241,234,0.02));
            box-shadow: 0 18px 40px rgba(0,0,0,0.28);
            transition:
              transform 0.4s cubic-bezier(0.22, 1, 0.36, 1),
              border-color 0.35s ease,
              box-shadow 0.35s ease,
              color 0.35s ease;
            animation: wings-circle-breathe 4.8s ease-in-out infinite;
          }
          .wings-circle-ring {
            position: absolute;
            inset: -12px;
            border-radius: 50%;
            border: 1.5px dashed rgba(232, 197, 71, 0.4);
            opacity: 0.55;
            animation: wings-ring-spin 18s linear infinite;
            pointer-events: none;
            transition: opacity 0.35s ease, border-color 0.35s ease;
          }
          .wings-circle-ring-inner {
            position: absolute;
            inset: 18%;
            border-radius: 50%;
            border: 1px solid rgba(232, 197, 71, 0.15);
            animation: wings-soft-pulse 2.8s ease-in-out infinite;
            pointer-events: none;
          }
          @keyframes wings-circle-breathe {
            0%, 100% { box-shadow: 0 18px 40px rgba(0,0,0,0.28), 0 0 0 0 rgba(232,197,71,0); }
            50% { box-shadow: 0 22px 48px rgba(0,0,0,0.32), 0 0 28px 2px rgba(232,197,71,0.08); }
          }
          .wings-glyph {
            position: relative;
            width: 88px;
            height: 88px;
            display: grid;
            place-items: center;
            z-index: 1;
          }
          .wings-glyph-core {
            position: relative;
            z-index: 2;
            display: grid;
            place-items: center;
          }
          .wings-glyph-orbit {
            position: absolute;
            inset: 0;
            border-radius: 50%;
            animation: wings-ring-spin 9s linear infinite;
            pointer-events: none;
          }
          .wings-glyph-orbit i {
            position: absolute;
            width: 5px;
            height: 5px;
            border-radius: 50%;
            background: var(--w-accent);
            box-shadow: 0 0 8px rgba(232, 197, 71, 0.55);
            top: 50%;
            left: 50%;
            margin: -2.5px 0 0 -2.5px;
          }
          .wings-glyph-orbit i:nth-child(1) { transform: rotate(0deg) translateY(-40px); }
          .wings-glyph-orbit i:nth-child(2) { transform: rotate(90deg) translateY(-40px); opacity: 0.7; }
          .wings-glyph-orbit i:nth-child(3) { transform: rotate(180deg) translateY(-40px); opacity: 0.45; }
          .wings-glyph-orbit i:nth-child(4) { transform: rotate(270deg) translateY(-40px); opacity: 0.8; }
          .wings-glyph-longform .wings-glyph-core {
            animation: wings-glyph-float 3.2s ease-in-out infinite;
          }
          .wings-glyph-longform .wings-glyph-play {
            transform-origin: 11px 12px;
            animation: wings-play-pulse 2.2s ease-in-out infinite;
          }
          .wings-glyph-shortform .wings-glyph-core {
            animation: wings-phone-tilt 3.6s ease-in-out infinite;
          }
          .wings-glyph-shortform .wings-glyph-lines {
            stroke-dasharray: 12;
            animation: wings-lines-scan 2.4s ease-in-out infinite;
          }
          .wings-glyph-default .wings-glyph-core {
            animation: wings-glyph-float 3s ease-in-out infinite;
          }
          @keyframes wings-glyph-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
          }
          @keyframes wings-play-pulse {
            0%, 100% { opacity: 0.75; transform: scale(0.92); }
            50% { opacity: 1; transform: scale(1.08); }
          }
          @keyframes wings-phone-tilt {
            0%, 100% { transform: rotate(-4deg) translateY(0); }
            50% { transform: rotate(4deg) translateY(-3px); }
          }
          @keyframes wings-lines-scan {
            0%, 100% { opacity: 0.45; stroke-dashoffset: 8; }
            50% { opacity: 1; stroke-dashoffset: 0; }
          }
          .wings-circle-pick:hover .wings-circle,
          .wings-circle-pick:focus-visible .wings-circle {
            transform: translateY(-6px) scale(1.04);
            border-color: rgba(232, 197, 71, 0.55);
            color: var(--w-accent);
            box-shadow:
              0 24px 48px rgba(0,0,0,0.4),
              0 0 0 1px rgba(232, 197, 71, 0.18);
            animation: none;
          }
          .wings-circle-pick:hover .wings-circle-ring,
          .wings-circle-pick:focus-visible .wings-circle-ring {
            opacity: 1;
            border-color: rgba(232, 197, 71, 0.7);
            animation: wings-ring-spin 8s linear infinite;
          }
          .wings-circle-pick:hover .wings-glyph-orbit {
            animation-duration: 4.5s;
          }
          .wings-circle-pick:active .wings-circle {
            transform: translateY(-2px) scale(0.98);
          }
          .wings-circle-meta {
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-height: 96px;
          }
          .wings-circle-tag {
            font-size: 14px;
            font-weight: 600;
            letter-spacing: 0.1em;
            color: var(--w-accent);
          }
          .wings-circle-title {
            font-size: clamp(17px, 2.8vw, 22px);
            font-weight: 700;
            letter-spacing: -0.02em;
            line-height: 1.3;
            word-break: break-word;
          }
          .wings-circle-blurb {
            margin: 0;
            font-size: clamp(13px, 2vw, 15px);
            line-height: 1.5;
            color: var(--w-muted);
          }
          @media (max-width: 520px) {
            .wings-program-grid {
              gap: 40px 18px;
            }
            .wings-circle-pick {
              width: min(170px, 46vw);
            }
            .wings-circle {
              width: clamp(140px, 40vw, 170px);
              height: clamp(140px, 40vw, 170px);
            }
          }
          .wings-ai-collect {
            margin: 64px auto 0;
            max-width: 720px;
            padding: 28px 20px 8px;
            text-align: center;
          }
          .wings-ai-collect-label {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 18px;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.12em;
            color: var(--w-accent);
          }
          .wings-ai-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: var(--w-accent);
            box-shadow: 0 0 10px rgba(232, 197, 71, 0.55);
            animation: wings-soft-pulse 1.4s ease-in-out infinite;
          }
          .wings-ai-stage {
            position: relative;
            height: 120px;
            overflow: hidden;
            border-radius: 16px;
            border: 1px solid rgba(244,241,234,0.08);
            background:
              linear-gradient(180deg, rgba(244,241,234,0.03), transparent 55%),
              rgba(0,0,0,0.22);
          }
          .wings-ai-scan {
            position: absolute;
            left: 0;
            right: 0;
            height: 28%;
            background: linear-gradient(
              180deg,
              transparent,
              rgba(232, 197, 71, 0.08),
              transparent
            );
            animation: wings-ai-scan 3.6s ease-in-out infinite;
            pointer-events: none;
          }
          @keyframes wings-ai-scan {
            0% { top: -20%; opacity: 0; }
            20% { opacity: 1; }
            80% { opacity: 1; }
            100% { top: 95%; opacity: 0; }
          }
          .wings-ai-core {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 18px;
            height: 18px;
            margin: -9px 0 0 -9px;
            border-radius: 50%;
            background: var(--w-accent);
            box-shadow:
              0 0 0 6px rgba(232, 197, 71, 0.12),
              0 0 22px rgba(232, 197, 71, 0.45);
            animation: wings-soft-pulse 2s ease-in-out infinite;
            z-index: 2;
          }
          .wings-ai-ring {
            position: absolute;
            left: 50%;
            top: 50%;
            border-radius: 50%;
            border: 1px solid rgba(232, 197, 71, 0.28);
            transform: translate(-50%, -50%);
            pointer-events: none;
          }
          .wings-ai-ring-a {
            width: 52px;
            height: 52px;
            animation: wings-ai-ring-pulse 2.4s ease-out infinite;
          }
          .wings-ai-ring-b {
            width: 86px;
            height: 86px;
            animation: wings-ai-ring-pulse 2.4s ease-out 0.7s infinite;
          }
          @keyframes wings-ai-ring-pulse {
            0% { opacity: 0.55; transform: translate(-50%, -50%) scale(0.85); }
            100% { opacity: 0; transform: translate(-50%, -50%) scale(1.25); }
          }
          .wings-ai-particle {
            position: absolute;
            top: 50%;
            width: 4px;
            height: 4px;
            margin-top: -2px;
            border-radius: 50%;
            background: rgba(244, 241, 234, 0.85);
            box-shadow: 0 0 8px rgba(232, 197, 71, 0.35);
            animation-name: wings-ai-ingest;
            animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
            animation-iteration-count: infinite;
          }
          .wings-ai-particle.from-left { left: 6%; }
          .wings-ai-particle.from-right { right: 6%; }
          @keyframes wings-ai-ingest {
            0% { transform: translateX(0) scale(0.6); opacity: 0; }
            15% { opacity: 1; }
            70% { opacity: 1; }
            100% { transform: translateX(var(--travel)) scale(0.2); opacity: 0; }
          }
          .wings-ai-bit {
            position: absolute;
            top: 18%;
            font-family: var(--font-geist-mono), ui-monospace, monospace;
            font-size: 10px;
            letter-spacing: 0.08em;
            color: rgba(232, 197, 71, 0.55);
            white-space: nowrap;
            animation: wings-ai-bit-flow 4.8s linear infinite;
            pointer-events: none;
          }
          @keyframes wings-ai-bit-flow {
            0% { transform: translateX(-20px); opacity: 0; }
            12% { opacity: 0.8; }
            88% { opacity: 0.8; }
            100% { transform: translateX(20px); opacity: 0; }
          }
          .wings-ai-status {
            margin: 14px 0 0;
            font-size: 12px;
            color: var(--w-muted);
            letter-spacing: 0.02em;
          }
          .wings-ai-status strong {
            color: rgba(244, 241, 234, 0.78);
            font-weight: 500;
          }
        `
      }} />

      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          borderBottom: '1px solid var(--w-line)',
          background: 'rgba(10, 11, 13, 0.72)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div
          style={{
            maxWidth: 960,
            margin: '0 auto',
            padding: '0 24px',
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <a href="/" style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              wings
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: 'var(--w-accent)',
                textTransform: 'uppercase',
              }}
            >
              AI
            </span>
          </a>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isLoading ? (
              <span style={{ fontSize: 13, color: 'var(--w-muted)' }}>…</span>
            ) : isLoggedIn ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {(user?.profileImage || user?.thumbnailImage) && (
                    <img 
                      src={user?.profileImage || user?.thumbnailImage} 
                      alt=""
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '1px solid var(--w-line)',
                      }}
                    />
                  )}
                  <span style={{ fontSize: 14, fontWeight: 500 }}>
                    {user?.nickname || '사용자'}
                  </span>
                </div>
                <button 
                  type="button"
                  onClick={handleLogout}
                  style={{
                    fontSize: 13,
                    color: 'var(--w-muted)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '6px 4px',
                  }}
                >
                  로그아웃
                </button>
              </>
            ) : (
                <button 
                type="button"
                  onClick={handleKakaoLogin}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#FEE500',
                  color: '#191600',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden>
                  <path
                    d="M9 0C4.03 0 0 3.58 0 8c0 2.88 1.89 5.32 4.5 6.27L3.18 18l4.05-2.22c1.08.3 2.22.46 3.4.46 4.97 0 9-3.58 9-8s-4.03-8-9-8z"
                    fill="currentColor"
                  />
                  </svg>
                  카카오 로그인
                </button>
            )}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px 80px' }}>
        <div className="wings-fade-up" style={{ marginBottom: 48, textAlign: 'center' }}>
          <p
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--w-accent)',
            }}
          >
            윙스 AI
          </p>
          <h1
            style={{
              margin: '10px 0 0',
              fontSize: 'clamp(28px, 5vw, 40px)',
              fontWeight: 700,
              letterSpacing: '-0.04em',
              lineHeight: 1.15,
            }}
          >
            프로그램
          </h1>
        </div>

        {programsLoading ? (
          <p className="wings-fade-up wings-fade-up-delay-1" style={{ color: 'var(--w-muted)', fontSize: 14 }}>
            불러오는 중…
          </p>
        ) : !isLoggedIn ? (
          <div
            className="wings-fade-up wings-fade-up-delay-1"
            style={{
              padding: '28px 0',
              borderTop: '1px solid var(--w-line)',
            }}
          >
            <p style={{ margin: '0 0 16px', fontSize: 15, color: 'var(--w-muted)', lineHeight: 1.6 }}>
              로그인하면 이용 가능한 프로그램이 표시됩니다.
            </p>
            <button
              type="button"
              onClick={handleKakaoLogin}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#FEE500',
                color: '#191600',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              카카오로 시작하기
            </button>
              </div>
            ) : programs.length === 0 ? (
          <p
            className="wings-fade-up wings-fade-up-delay-1"
            style={{
              padding: '28px 0',
              borderTop: '1px solid var(--w-line)',
              color: 'var(--w-muted)',
              fontSize: 15,
            }}
          >
            사용 가능한 프로그램이 없습니다.
            {isApproved === false
              ? ' 관리자 승인 후 롱폼·숏폼을 이용할 수 있습니다.'
              : programsMessage
                ? ` ${programsMessage}`
                : ''}
          </p>
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

            {[
              { side: 'from-left', top: '28%', delay: '0s', dur: '2.4s', travel: '210px' },
              { side: 'from-left', top: '48%', delay: '0.5s', dur: '2.8s', travel: '210px' },
              { side: 'from-left', top: '68%', delay: '1.1s', dur: '2.2s', travel: '210px' },
              { side: 'from-right', top: '32%', delay: '0.3s', dur: '2.5s', travel: '-210px' },
              { side: 'from-right', top: '52%', delay: '0.9s', dur: '2.7s', travel: '-210px' },
              { side: 'from-right', top: '72%', delay: '1.4s', dur: '2.3s', travel: '-210px' },
            ].map((p, i) => (
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

            <span className="wings-ai-bit" style={{ left: '8%', animationDelay: '0s' }}>
              01001101
            </span>
            <span className="wings-ai-bit" style={{ left: '28%', top: '58%', animationDelay: '1.2s' }}>
              FRAME·48
            </span>
            <span className="wings-ai-bit" style={{ left: '52%', top: '22%', animationDelay: '2.1s' }}>
              TTS·SYNC
              </span>
            <span className="wings-ai-bit" style={{ left: '72%', top: '62%', animationDelay: '0.7s' }}>
              CLIP·OK
              </span>
          </div>
          <p className="wings-ai-status">
            <strong>윙스 AI</strong>가 유튜브 제작 데이터를 수집·분석 중입니다
          </p>
        </div>
      </main>
    </div>
  )
}

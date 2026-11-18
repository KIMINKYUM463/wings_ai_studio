'use client';
import { useEffect, useState } from 'react';
import { mediaUrl } from '@/lib/wings-shopping-v2/client';
import type { Project } from '@/lib/wings-shopping-v2/types';

const STAGES = [
  { name: '참고 영상 내려받기', until: 0.4 },
  { name: '장면이 바뀌는 지점 나누기', until: 0.55 },
  { name: '첫 3초 훅과 흐름 읽기', until: 0.7 },
  { name: '상품 이름·특징 알아보기', until: 0.85 },
  { name: '같은 상품 찾을 검색어 만들기', until: 1 },
];
const FEED = [
  '화면 속 글자를 읽는 중',
  '장면이 바뀌는 순간을 표시하는 중',
  '첫 문장이 왜 멈추게 하는지 보는 중',
  '상품이 처음 나오는 장면을 찾는 중',
  '말투와 말하는 속도를 재는 중',
  '마지막 행동 유도 문장을 찾는 중',
];

/**
 * AI 영상 분석 로딩: 참고 영상 위로 스캔 라인이 지나가고, 단계·경과 시간·지금 보는 것을 보여 준다.
 * 서버 진행률은 내려받기(0.1) → 분석(0.4) 두 단계뿐이라, 분석 중 세부 단계는 경과 시간으로 나눠 보여 준다.
 */
export default function AnalyzeLoading({ project, progress = 0, message }: { project: Project; progress?: number; message?: string }) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  const [videoOk, setVideoOk] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const sec = Math.floor((now - start) / 1000);
  const downloading = progress < 0.4;
  // 분석 중(0.4~)에는 약 90초 동안 0.4 → 0.97 로 천천히 채운다
  const shown = downloading ? Math.max(0.05, progress) : Math.min(0.97, 0.4 + (sec / 90) * 0.57);
  const active = STAGES.findIndex((s) => shown < s.until);
  const feed = FEED[Math.floor(sec / 3) % FEED.length];

  return (
    <div className="mt-2 grid gap-8 rounded-[28px] border border-line bg-gradient-to-br from-white to-[#f4f5ff] p-6 md:grid-cols-[220px_minmax(0,1fr)] md:p-8" aria-live="polite">
      <style>{`
        @keyframes al-scan { 0% { top: -10%; } 100% { top: 105%; } }
        @keyframes al-blink { 50% { opacity: .35; } }
        @keyframes al-shimmer { from { background-position: -240px 0; } to { background-position: 240px 0; } }
        .al-scan { animation: al-scan 2.4s cubic-bezier(.45,0,.55,1) infinite; }
        .al-blink { animation: al-blink 1.2s ease-in-out infinite; }
        .al-shimmer { background: linear-gradient(90deg,#e9ebf5 0,#f6f7fc 50%,#e9ebf5 100%); background-size: 480px 100%; animation: al-shimmer 1.4s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .al-scan, .al-blink, .al-shimmer { animation: none !important; } }
      `}</style>

      {/* 스캔 중인 참고 영상 */}
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[220px] overflow-hidden rounded-[22px] bg-[#0e1016] shadow-[0_30px_60px_-30px_rgba(47,59,235,0.6)]">
        {!downloading && videoOk ? (
          <video src={mediaUrl(project.id, 'sources/ref.mp4')} autoPlay muted loop playsInline className="h-full w-full object-cover opacity-90" onError={() => setVideoOk(false)} />
        ) : (
          <div className="al-shimmer h-full w-full opacity-20" />
        )}
        {/* 격자 + 초점 모서리 */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] bg-[size:100%_12.5%,25%_100%]" />
        {['left-3 top-3 border-l-2 border-t-2', 'right-3 top-3 border-r-2 border-t-2', 'bottom-3 left-3 border-b-2 border-l-2', 'bottom-3 right-3 border-b-2 border-r-2'].map((c) => (
          <span key={c} aria-hidden className={`absolute h-5 w-5 rounded-sm border-white/90 ${c}`} />
        ))}
        <div aria-hidden className="al-scan absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-[rgba(110,124,255,0.45)] to-transparent">
          <div className="absolute inset-x-0 top-1/2 h-[2px] bg-[#9aa4ff] shadow-[0_0_14px_3px_rgba(110,124,255,0.9)]" />
        </div>
        <span className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          <span className="al-blink h-1.5 w-1.5 rounded-full bg-[#ff3d2e]" /> {downloading ? '영상 받는 중' : '분석 중'}
        </span>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-2xl font-bold tracking-[-0.02em] text-text">AI가 영상을 읽고 있어요</h3>
          <span className="tabular-nums text-sm text-muted">{String(Math.floor(sec / 60)).padStart(1, '0')}:{String(sec % 60).padStart(2, '0')} 경과 · 보통 1~2분</span>
        </div>

        {/* 진행 막대 */}
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#e8eaf3]">
          <div className="h-full rounded-full bg-gradient-to-r from-[#2f3beb] via-[#6d5cff] to-[#20c5ff] transition-[width] duration-700" style={{ width: `${Math.round(shown * 100)}%` }} />
        </div>

        <ol className="mt-6 space-y-3">
          {STAGES.map((s, i) => {
            const done = i < active || active === -1;
            const now = i === active;
            return (
              <li key={s.name} className={`flex items-center gap-3 text-[15px] ${done ? 'text-text' : now ? 'font-semibold text-text' : 'text-[#a3a8b6]'}`}>
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${done ? 'bg-[var(--amber)] text-white' : now ? 'border-2 border-[var(--amber)] text-[var(--amber)]' : 'border border-[#d5d8e2]'}`}>
                  {done ? '✓' : i + 1}
                </span>
                {s.name}
                {now && <span className="al-blink text-[var(--amber)]">···</span>}
              </li>
            );
          })}
        </ol>

        <p key={feed} className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-muted ring-1 ring-line">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--amber)]" /> 지금: {downloading ? (message ?? '참고 영상을 받는 중') : feed}
        </p>
      </div>
    </div>
  );
}

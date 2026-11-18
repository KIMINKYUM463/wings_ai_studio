'use client';
import { useEffect, useState } from 'react';
import { PLATFORM_COLOR, PLATFORM_LABEL } from './ui';

const PLATFORMS = ['youtube', 'tiktok', 'instagram', 'douyin', 'xiaohongshu'] as const;

/**
 * 같은 상품 영상을 찾는 동안: 가운데 AI에서 신호가 퍼지고 다섯 플랫폼이 궤도를 돌며,
 * 지금 넣고 있는 검색어가 차례로 바뀐다. 아래에는 결과가 채워질 카드 자리가 반짝인다.
 */
export default function SearchRadar({ keywords, message }: { keywords: string[]; message?: string }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1100);
    return () => clearInterval(t);
  }, []);
  const kw = keywords.length ? keywords[tick % keywords.length] : '상품 이름';
  const activePf = PLATFORMS[tick % PLATFORMS.length];

  return (
    <div aria-live="polite">
      <style>{`
        @keyframes sr-ring { 0% { transform: translate(-50%,-50%) scale(.2); opacity: .55; } 100% { transform: translate(-50%,-50%) scale(1); opacity: 0; } }
        @keyframes sr-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes sr-counter { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        @keyframes sr-sweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes sr-shimmer { from { background-position: -300px 0; } to { background-position: 300px 0; } }
        @keyframes sr-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .sr-ring { animation: sr-ring 2.4s cubic-bezier(.2,.7,.3,1) infinite; }
        .sr-orbit { animation: sr-orbit 18s linear infinite; }
        .sr-counter { animation: sr-counter 18s linear infinite; }
        .sr-sweep { animation: sr-sweep 2.6s linear infinite; }
        .sr-shimmer { background: linear-gradient(90deg,#eceef4 0,#f7f8fb 50%,#eceef4 100%); background-size: 600px 100%; animation: sr-shimmer 1.4s linear infinite; }
        .sr-in { animation: sr-in .35s ease both; }
        @media (prefers-reduced-motion: reduce) { .sr-ring, .sr-orbit, .sr-counter, .sr-sweep, .sr-shimmer, .sr-in { animation: none !important; } }
      `}</style>

      <div className="grid items-center gap-8 rounded-3xl bg-gradient-to-br from-[#f6f7ff] to-white p-6 ring-1 ring-line md:grid-cols-[340px_minmax(0,1fr)] md:p-8">
        {/* 레이더 */}
        <div className="relative mx-auto aspect-square w-full max-w-[320px]">
          {/* 퍼지는 신호 */}
          {[0, 0.8, 1.6].map((d) => (
            <span key={d} aria-hidden className="sr-ring absolute left-1/2 top-1/2 h-full w-full rounded-full border-2 border-[color-mix(in_srgb,var(--amber)_45%,transparent)]" style={{ animationDelay: `${d}s` }} />
          ))}
          {/* 궤도 선 */}
          <span aria-hidden className="absolute inset-[11%] rounded-full border border-dashed border-[#c9cdf7]" />
          {/* 훑는 빛 */}
          <span aria-hidden className="sr-sweep absolute inset-[11%] rounded-full" style={{ background: 'conic-gradient(from 0deg, rgba(47,59,235,.22), transparent 70deg)' }} />
          {/* 가운데 AI */}
          <div className="absolute left-1/2 top-1/2 grid h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[var(--amber)] text-white shadow-[0_18px_40px_-12px_rgba(47,59,235,0.8)]">
            <span className="text-xl font-black tracking-tight">AI</span>
          </div>
          {/* 궤도를 도는 플랫폼 */}
          <div className="sr-orbit absolute inset-[11%]">
            {PLATFORMS.map((p, i) => {
              const ang = (i / PLATFORMS.length) * Math.PI * 2 - Math.PI / 2;
              const on = p === activePf;
              return (
                <div key={p} className="absolute" style={{ left: `${50 + 50 * Math.cos(ang)}%`, top: `${50 + 50 * Math.sin(ang)}%`, transform: 'translate(-50%,-50%)' }}>
                  <div className="sr-counter">
                    <span className={`flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-bold text-text shadow-md ring-1 transition duration-300 ${on ? 'scale-110 ring-2' : 'ring-black/5'}`}
                      style={on ? { boxShadow: `0 0 0 2px ${PLATFORM_COLOR[p]}, 0 10px 24px -8px ${PLATFORM_COLOR[p]}` } : undefined}>
                      <span className="h-2 w-2 rounded-full" style={{ background: PLATFORM_COLOR[p] }} />
                      {PLATFORM_LABEL[p]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 지금 하는 일 */}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--amber)]">같은 상품 영상을 찾고 있어요</p>
          <p key={`${kw}-${activePf}`} className="sr-in mt-2 text-2xl font-bold leading-snug tracking-[-0.02em] text-text">
            <span style={{ color: PLATFORM_COLOR[activePf] }}>{PLATFORM_LABEL[activePf]}</span>에서<br />“{kw}” 검색 중
          </p>
          <ol className="mt-6 space-y-2.5 text-sm">
            {['플랫폼마다 검색어 넣기', '쇼츠·릴스 길이 영상만 고르기', '같은 영상·중복 빼기', '썸네일 가져오기'].map((s, i) => {
              const step = Math.min(3, Math.floor(tick / 4));
              return (
                <li key={s} className={`flex items-center gap-2.5 ${i <= step ? 'text-text' : 'text-[#a3a8b6]'}`}>
                  <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${i < step ? 'bg-[var(--amber)] text-white' : i === step ? 'border-2 border-[var(--amber)] text-[var(--amber)]' : 'border border-[#d5d8e2]'}`}>{i < step ? '✓' : i + 1}</span>
                  {s}
                </li>
              );
            })}
          </ol>
          {message && <p className="mt-5 text-xs text-muted">{message}</p>}
        </div>
      </div>

      <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[...Array(10)].map((_, i) => <li key={i} className="sr-shimmer aspect-[9/16] rounded-2xl" style={{ animationDelay: `${i * 0.08}s` }} />)}
      </ul>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';

type Beat = { role: string; text: string; why: string };

/** 깔때기 단계 (AIDA): 문장 역할 → 시청자 마음이 어디까지 왔는지 */
const STAGES = [
  { id: 'attention', name: '주목', sub: '스크롤을 멈춘다', color: '#f59e0b', roles: ['hook', 'curiosity'] },
  { id: 'interest', name: '흥미', sub: '내 얘기 같다', color: '#ef4444', roles: ['setup', 'conflict', 'problem', 'twist', 'emotion', 'before'] },
  { id: 'desire', name: '욕구', sub: '갖고 싶어진다', color: '#3b82f6', roles: ['product_intro', 'feature', 'usage', 'reveal', 'demo', 'proof', 'social_proof', 'comparison', 'price', 'after', 'rank_item', 'verdict', 'con'] },
  { id: 'action', name: '행동', sub: '링크를 누른다', color: '#8b5cf6', roles: ['cta', 'closing'] },
] as const;
export const stageOf = (role: string, i: number, n: number) =>
  STAGES.find((s) => (s.roles as readonly string[]).includes(role)) ?? (i === 0 ? STAGES[0] : i === n - 1 ? STAGES[3] : STAGES[2]);

/**
 * 대본 깔때기: 문장이 위(넓은 주목)에서 아래(좁은 행동)로 시청자를 좁혀 가는 모습.
 * 층을 누르면 그 문장 분석을 보여주고, 손대지 않으면 위에서부터 차례로 짚어 준다.
 */
export default function ScriptFunnel({ beats, roleLabel }: { beats: Beat[]; roleLabel: Record<string, string> }) {
  const n = beats.length;
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setActive((a) => (a + 1) % n), 3200);
    return () => clearInterval(t);
  }, [auto, n]);

  const b = beats[active]!;
  const st = stageOf(b.role, active, n);
  // 층 너비: 맨 위 100% → 맨 아래 40%
  const width = (i: number) => 100 - (60 * i) / Math.max(1, n - 1);
  const stagesUsed = STAGES.filter((s) => beats.some((x, i) => stageOf(x.role, i, n).id === s.id));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <style>{`
        @keyframes sf-drop { from { opacity: 0; transform: translateY(-14px) scaleX(.85); } to { opacity: 1; transform: none; } }
        @keyframes sf-flow { 0% { transform: translateY(0); opacity: 0; } 12% { opacity: .9; } 88% { opacity: .9; } 100% { transform: translateY(var(--sf-h)); opacity: 0; } }
        @keyframes sf-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .sf-drop { animation: sf-drop .55s cubic-bezier(.2,.8,.2,1) both; }
        .sf-dot { animation: sf-flow 2.6s linear infinite; }
        .sf-fade { animation: sf-fade .4s ease both; }
        @media (prefers-reduced-motion: reduce) { .sf-drop, .sf-dot, .sf-fade { animation: none !important; } }
      `}</style>

      {/* 깔때기 */}
      <div className="relative rounded-3xl bg-gradient-to-b from-[#f8fafc] to-white p-5 ring-1 ring-[#eef1f6]">
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
          {stagesUsed.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5 text-xs text-[#475569]">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              <b className="font-semibold text-[#0f172a]">{s.name}</b> {s.sub}
            </span>
          ))}
        </div>
        <div className="relative" style={{ ['--sf-h' as string]: `${n * 56}px` }}>
          {/* 흘러 내려가는 시청자 (점) */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center" style={{ height: n * 56 }}>
            {[0, 1, 2, 3, 4].map((k) => (
              <span key={k} className="sf-dot absolute top-0 h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,.9)]"
                style={{ animationDelay: `${k * 0.52}s`, marginLeft: `${(k - 2) * 14}px` }} />
            ))}
          </div>
          <ol className="flex flex-col items-center gap-1">
            {beats.map((x, i) => {
              const s = stageOf(x.role, i, n);
              const on = i === active;
              return (
                <li key={i} className="sf-drop w-full" style={{ animationDelay: `${i * 110}ms` }}>
                  <button type="button" onClick={() => { setActive(i); setAuto(false); }} aria-pressed={on}
                    className="mx-auto flex h-[52px] items-center justify-center gap-2 px-6 text-white transition-[filter,transform] duration-300 hover:brightness-110"
                    style={{
                      width: `${width(i)}%`,
                      background: `linear-gradient(180deg, ${s.color}, ${s.color}d9)`,
                      clipPath: i === n - 1 ? 'polygon(0 0,100% 0,88% 100%,12% 100%)' : 'polygon(0 0,100% 0,96% 100%,4% 100%)',
                      filter: on ? 'saturate(1.15) drop-shadow(0 6px 14px rgba(15,23,42,.25))' : 'saturate(.75) brightness(.97)',
                      transform: on ? 'scale(1.03)' : undefined,
                    }}>
                    <span className="text-xs font-bold tabular-nums opacity-80">{i + 1}</span>
                    <span className="truncate text-[13px] font-semibold">{roleLabel[x.role] ?? x.role}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <p className="mt-3 text-center text-[11px] text-[#94a3b8]">층을 누르면 그 문장 분석을 볼 수 있어요</p>
      </div>

      {/* 고른 층 분석 */}
      <div className="flex flex-col">
        <div key={active} className="sf-fade flex flex-1 flex-col rounded-3xl p-6 text-white" style={{ background: `linear-gradient(160deg, #0f172a 0%, #1e293b 70%, ${st.color}55 100%)` }}>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full px-2.5 py-1 font-bold" style={{ background: st.color }}>{st.name} 단계</span>
            <span className="text-white/60">{st.sub}</span>
            <span className="ml-auto tabular-nums text-white/50">{active + 1} / {n}</span>
          </div>
          <p className="mt-5 text-[11px] font-semibold text-white/50">{roleLabel[b.role] ?? b.role}</p>
          <p className="mt-1 text-xl font-bold leading-snug tracking-tight text-balance">“{b.text}”</p>
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="text-[11px] font-semibold text-white/50">왜 효과적인가</p>
            <p className="mt-1 text-sm leading-relaxed text-white/85">{b.why}</p>
          </div>
          {/* 진행 */}
          <div className="mt-auto flex gap-1 pt-6" aria-hidden>
            {beats.map((_, i) => (
              <span key={i} className="h-1 flex-1 rounded-full" style={{ background: i <= active ? st.color : 'rgba(255,255,255,.15)' }} />
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <button type="button" className="rounded-full px-3 py-1.5 font-semibold text-[#475569] hover:bg-[#f1f5f9]" onClick={() => { setAuto(false); setActive((a) => (a - 1 + n) % n); }}>← 이전 문장</button>
          <button type="button" className="rounded-full px-3 py-1.5 font-semibold text-[#475569] hover:bg-[#f1f5f9]" onClick={() => setAuto((v) => !v)}>{auto ? '❚❚ 자동 넘김 멈춤' : '▶ 자동 넘김'}</button>
          <button type="button" className="rounded-full px-3 py-1.5 font-semibold text-[#475569] hover:bg-[#f1f5f9]" onClick={() => { setAuto(false); setActive((a) => (a + 1) % n); }}>다음 문장 →</button>
        </div>
      </div>
    </div>
  );
}

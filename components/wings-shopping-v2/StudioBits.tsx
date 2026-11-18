'use client';

/** 휴대폰 모양 틀 (카메라 홈·홈 바는 테두리 여백에 둬서 화면을 가리지 않음) */
export function PhoneFrame({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return (
    <PhoneShell className={className}>
      <img src={src} alt={alt} className="aspect-[9/16] w-full rounded-[1.6rem] bg-black object-cover" />
    </PhoneShell>
  );
}

/** 같은 휴대폰 테두리에 화면(영상 등)을 직접 넣는 버전 */
export function PhoneShell({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div style={style} className={`mx-auto w-full max-w-[290px] rounded-[2.6rem] bg-[#16181d] px-2.5 pb-3 pt-2.5 shadow-[0_24px_48px_-20px_rgba(0,0,0,0.55)] ring-1 ring-black/40 ${className}`}>
      <div className="mb-2 flex justify-center" aria-hidden>
        <span className="h-[18px] w-24 rounded-full bg-black ring-1 ring-white/5" />
      </div>
      {children}
      <div className="mt-2.5 flex justify-center" aria-hidden>
        <span className="h-1 w-24 rounded-full bg-white/40" />
      </div>
    </div>
  );
}

/** 소리 막대가 오르내리는 작은 애니메이션 (음성 만드는 중 표시용) */
export function VoiceBars({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex h-4 items-end gap-[3px] ${className}`} aria-hidden>
      <style>{`
        @keyframes vb-bounce { 0%, 100% { transform: scaleY(0.3); } 50% { transform: scaleY(1); } }
        @media (prefers-reduced-motion: reduce) { .vb-bar { animation: none !important; transform: scaleY(0.6) !important; } }
      `}</style>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="vb-bar w-[3px] origin-bottom rounded-full bg-amber" style={{ height: '100%', animation: `vb-bounce 0.9s ease-in-out ${i * 0.12}s infinite` }} />
      ))}
    </span>
  );
}

/** 음성 생성 진행 패널: 지금 몇 번째 문장을 만드는지 + 그 문장 미리보기 */
export function VoiceGeneratingPanel({ current, total, text }: { current: number; total: number; text?: string }) {
  const pct = total ? Math.round(((current - 1) / total) * 100) : 0;
  const line = (text ?? '').split('\n').map((l) => l.trim()).filter(Boolean).join(' ');
  return (
    <div role="status" aria-live="polite" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0e1016] via-[#161a2e] to-[#232a6b] p-6 text-white">
      <style>{`
        @keyframes vg-bar { 0%, 100% { transform: scaleY(.25); } 50% { transform: scaleY(1); } }
        @keyframes vg-sweep { from { background-position: 100% 0; } to { background-position: 0 0; } }
        @keyframes vg-ring { 0% { transform: scale(.8); opacity: .6; } 100% { transform: scale(1.6); opacity: 0; } }
        .vg-bar { animation: vg-bar 1s ease-in-out infinite; transform-origin: center; }
        .vg-sweep { background: linear-gradient(90deg, #fff 0 50%, rgba(255,255,255,.35) 50% 100%); background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: vg-sweep 3.2s linear infinite; }
        .vg-ring { animation: vg-ring 1.8s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) { .vg-bar, .vg-sweep, .vg-ring { animation: none !important; } .vg-sweep { color: #fff; } }
      `}</style>
      <span aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#6d5cff]/25 blur-3xl" />
      <div className="relative flex items-center gap-5">
        {/* 마이크 + 퍼지는 소리 */}
        <div className="relative grid h-16 w-16 shrink-0 place-items-center">
          <span aria-hidden className="vg-ring absolute inset-0 rounded-full border-2 border-[#7a86ff]" />
          <span aria-hidden className="vg-ring absolute inset-0 rounded-full border-2 border-[#7a86ff]" style={{ animationDelay: '.9s' }} />
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[#2f3beb] text-2xl shadow-[0_10px_30px_-8px_rgba(47,59,235,0.9)]" aria-hidden>🎙️</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white/60">AI 성우가 녹음하고 있어요 · {current}/{total}</p>
          <p className="mt-1 text-lg font-bold tracking-[-0.01em]">{current}번 문장 목소리 만드는 중</p>
        </div>
        {/* 이퀄라이저 */}
        <span className="hidden h-12 items-center gap-[3px] sm:flex" aria-hidden>
          {Array.from({ length: 16 }, (_, i) => (
            <span key={i} className="vg-bar w-[4px] rounded-full bg-gradient-to-t from-[#2f3beb] to-[#22d3ee]" style={{ height: `${30 + ((i * 37) % 70)}%`, animationDelay: `${(i % 6) * 0.11}s` }} />
          ))}
        </span>
      </div>
      {line && <p className="vg-sweep relative mt-5 line-clamp-2 text-xl font-bold leading-snug">“{line}”</p>}
      {/* 문장 점: 끝난 것 · 지금 · 남은 것 */}
      <div className="relative mt-5 flex items-center gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < current - 1 ? 'bg-[#7a86ff]' : i === current - 1 ? 'bg-white' : 'bg-white/15'}`} />
        ))}
      </div>
      <p className="relative mt-2 text-xs tabular-nums text-white/50">{Math.max(0, pct)}% · 문장마다 몇 초씩 걸려요</p>
    </div>
  );
}

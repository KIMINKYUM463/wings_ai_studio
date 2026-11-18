'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/wings-shopping-v2/client';
import ScriptFunnel from './ScriptFunnel';

type Sample = {
  summary: string;
  hook: { type: string; why: string };
  beats: { role: string; text: string; why: string }[];
  retention: string[];
  product: string;
};

/** 역할 묶음별 색: 훅 · 갈등 · 상품 · 증거 · 행동 유도 */
const ROLE_TONE: Record<string, string> = {
  hook: '#f59e0b', curiosity: '#f59e0b', setup: '#94a3b8',
  conflict: '#ef4444', problem: '#ef4444', twist: '#ef4444', emotion: '#ec4899',
  product_intro: '#3b82f6', feature: '#3b82f6', usage: '#3b82f6', reveal: '#6366f1', demo: '#3b82f6',
  proof: '#10b981', social_proof: '#10b981', comparison: '#10b981', price: '#14b8a6',
  cta: '#8b5cf6', closing: '#8b5cf6',
};
const tone = (r: string) => ROLE_TONE[r] ?? '#94a3b8';

const STAGES = ['구조 흐름 읽는 중', '첫 3초 훅 설계', '문장마다 역할 배치', '이탈 막는 장치 점검'];

/** 대본 구조 상세보기: 이 상품으로 쓴 샘플 대본과 문장별 분석 */
export default function StructureDetail({
  projectId, structureId, name, english, description, flow, roleLabel, selected, onUse, onClose,
}: {
  projectId: string; structureId: string; name: string; english?: string; description: string; flow: string;
  roleLabel: Record<string, string>; selected: boolean; onUse: () => void; onClose: () => void;
}) {
  const [sample, setSample] = useState<Sample | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState(0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setSample(null);
    setError(null);
    setStage(0);
    const timer = setInterval(() => setStage((s) => Math.min(STAGES.length - 1, s + 1)), 1400);
    api<Sample>(`/api/wings-shopping-v2/projects/${projectId}/script-sample?structureId=${encodeURIComponent(structureId)}${nonce ? '&force=1' : ''}`)
      .then((d) => { if (alive) setSample(d); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => clearInterval(timer));
    return () => { alive = false; clearInterval(timer); };
  }, [projectId, structureId, nonce]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={`${name} 상세보기`} className="fixed inset-0 z-[60] grid place-items-center bg-[#0b1020]/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <style>{`
        @keyframes sd-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes sd-shimmer { from { background-position: -320px 0; } to { background-position: 320px 0; } }
        .sd-rise { animation: sd-rise .45s cubic-bezier(.2,.7,.2,1) both; }
        .sd-shimmer { background: linear-gradient(90deg,#eef1f6 0,#f8fafc 50%,#eef1f6 100%); background-size: 640px 100%; animation: sd-shimmer 1.4s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .sd-rise, .sd-shimmer { animation: none !important; } }
      `}</style>
      <div className="flex max-h-[90vh] w-[min(96vw,64rem)] flex-col overflow-hidden rounded-3xl bg-white text-[#0f172a] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* 머리 */}
        <div className="relative border-b border-[#eef1f6] bg-gradient-to-br from-[#0f172a] to-[#1e293b] px-7 py-6 text-white">
          <button type="button" aria-label="닫기" className="absolute right-5 top-4 rounded-full px-2 text-2xl leading-none text-white/60 hover:text-white" onClick={onClose}>×</button>
          {english && <p className="text-[11px] font-semibold tracking-[0.18em] text-white/50">{english}</p>}
          <h3 className="mt-1 text-2xl font-bold tracking-tight">{name}</h3>
          <p className="mt-1 text-sm text-white/70">{description}</p>
          {flow && (
            <ol className="mt-4 flex flex-wrap items-center gap-y-2">
              {flow.split(/\s*→\s*/).map((part, i) => (
                <li key={i} className="flex items-center">
                  {i > 0 && <span aria-hidden className="mx-1.5 h-px w-3 bg-white/30" />}
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/90 ring-1 ring-white/15">{part}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ) : !sample ? (
            /* 분석 연출 */
            <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]" aria-live="polite">
              <ol className="space-y-3">
                {STAGES.map((s, i) => (
                  <li key={s} className={`flex items-center gap-2.5 text-sm ${i <= stage ? 'text-[#0f172a]' : 'text-[#94a3b8]'}`}>
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${i < stage ? 'bg-[#0f172a] text-white' : i === stage ? 'border-2 border-[#f59e0b] text-[#f59e0b]' : 'border border-[#cbd5e1]'}`}>
                      {i < stage ? '✓' : i + 1}
                    </span>
                    {s}{i === stage && '...'}
                  </li>
                ))}
              </ol>
              <div className="space-y-3">
                <p className="text-xs text-[#64748b]">이 상품으로 샘플 대본을 쓰고 문장마다 분석하고 있어요. 처음 한 번만 걸리고 다음부터는 바로 열려요.</p>
                {[92, 70, 84, 60, 76].map((w, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="sd-shimmer h-6 w-14 shrink-0 rounded-full" />
                    <span className="sd-shimmer h-6 rounded-lg" style={{ width: `${w}%` }} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-7">
              <p className="sd-rise text-lg font-semibold leading-relaxed tracking-tight text-balance">{sample.summary}</p>

              {/* 훅 분석 */}
              <div className="sd-rise grid gap-1 rounded-2xl border border-[#fde68a] bg-[#fffbeb] px-5 py-4" style={{ animationDelay: '140ms' }}>
                <p className="text-xs font-semibold text-[#b45309]">첫 3초 훅 · {sample.hook.type}</p>
                <p className="text-sm text-[#78350f]">{sample.hook.why}</p>
              </div>

              {/* 깔때기: 주목 → 흥미 → 욕구 → 행동 */}
              <div className="sd-rise" style={{ animationDelay: '180ms' }}>
                <ScriptFunnel beats={sample.beats} roleLabel={roleLabel} />
              </div>

              {sample.retention.length > 0 && (
                <div className="sd-rise" style={{ animationDelay: '320ms' }}>
                  <p className="text-sm font-bold">끝까지 보게 만드는 장치</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {sample.retention.map((r) => <li key={r} className="rounded-full bg-[#f1f5f9] px-3 py-1.5 text-xs text-[#334155]">{r}</li>)}
                  </ul>
                </div>
              )}
              <p className="text-xs text-[#94a3b8]">샘플은 「{sample.product}」로 쓴 예시예요. 실제 대본은 이 구조를 따라 장면에 맞게 새로 써요.</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#eef1f6] px-7 py-4">
          {sample && (
            <button type="button" className="rounded-full border border-[#e2e8f0] px-4 py-2 text-sm font-semibold text-[#334155] hover:border-[#94a3b8]" onClick={() => setNonce((n) => n + 1)}>
              다른 샘플 보기
            </button>
          )}
          <button type="button" className="rounded-full bg-[#0f172a] px-5 py-2 text-sm font-bold text-white hover:bg-[#1e293b] disabled:opacity-50" disabled={selected} onClick={onUse}>
            {selected ? '지금 쓰는 구조' : '이 구조로 쓰기'}
          </button>
        </div>
      </div>
    </div>
  );
}

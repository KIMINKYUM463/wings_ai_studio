'use client';
import { useEffect, useState } from 'react';
import { patchProject } from '@/lib/wings-shopping-v2/client';
import { DEFAULT_REMIX_SCRIPT_TEMPLATE_ID, REMIX_SCRIPT_TEMPLATES, type RemixScriptTemplate } from '@/lib/shotform-remix-script-templates';
import type { Project } from '@/lib/wings-shopping-v2/types';
import { ROLE_LABEL } from './SsulPanel';
import ScriptFunnel, { stageOf } from './ScriptFunnel';

const LIMIT = 16;

/** 리믹스 대본 공식 고르기: 지금 공식 요약 + 공식 카드 (흐름 띠) + 예시 보기 팝업 (깔때기 분석) */
export default function RemixFormulaPicker({ project, setProject }: { project: Project; setProject: (p: Project) => void }) {
  const current = project.scriptTemplateId || DEFAULT_REMIX_SCRIPT_TEMPLATE_ID;
  const [detail, setDetail] = useState<RemixScriptTemplate | null>(null);
  const [cat, setCat] = useState('전체');
  const [more, setMore] = useState(false);
  const catOf = (t: RemixScriptTemplate) => t.category ?? '기본';
  const cats = ['전체', ...Array.from(new Set(REMIX_SCRIPT_TEMPLATES.map(catOf)))];
  const shown = cat === '전체' ? REMIX_SCRIPT_TEMPLATES : REMIX_SCRIPT_TEMPLATES.filter((t) => catOf(t) === cat);
  // 처음엔 16개만 (지금 쓰는 공식이 뒤에 있으면 그것도 함께), 나머지는 더보기
  const limited = shown.slice(0, LIMIT).concat(shown.slice(LIMIT).filter((t) => t.id === current));
  const cur = REMIX_SCRIPT_TEMPLATES.find((t) => t.id === current) ?? REMIX_SCRIPT_TEMPLATES[0]!;
  const pick = async (id: string) => {
    setProject({ ...project, scriptTemplateId: id });
    setProject(await patchProject(project.id, { scriptTemplateId: id }));
  };

  return (
    <section className="overflow-hidden rounded-[28px] border border-line bg-panel">
      <style>{`
        @keyframes rf-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .rf-in { animation: rf-in .45s cubic-bezier(.2,.8,.2,1) backwards; }
        @media (prefers-reduced-motion: reduce) { .rf-in { animation: none !important; } }
      `}</style>

      {/* 지금 쓰는 공식 */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#0e1016] via-[#1b1f3a] to-[#2f3beb] px-6 py-6 text-white md:px-8">
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#6d5cff]/30 blur-3xl" />
        <p className="text-xs font-semibold text-white/60">지금 쓰는 대본 공식</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold tracking-[-0.02em]">{cur.name}</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/75">{cur.oneLiner}</p>
          </div>
          <button type="button" onClick={() => setDetail(cur)} className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/25">예시 대본 보기</button>
        </div>
        <ol className="mt-4 flex flex-wrap items-center gap-y-2">
          {cur.steps.map((s, i) => (
            <li key={i} className="flex items-center">
              {i > 0 && <span aria-hidden className="mx-1.5 h-px w-4 bg-white/30" />}
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/15">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: stageOf(s.role, i, cur.steps.length).color }} />
                {ROLE_LABEL[s.role] ?? s.role}
              </span>
            </li>
          ))}
        </ol>
      </header>

      <div className="px-6 py-6 md:px-8">
        <p className="text-sm text-muted">고른 흐름대로 AI가 장면에 맞춰 대본을 써요. 바꾼 뒤 「대본 새로 쓰기」를 누르면 반영돼요.</p>
        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="대본 공식 분류">
          {cats.map((c) => (
            <button key={c} type="button" role="tab" aria-selected={cat === c} onClick={() => { setCat(c); setMore(false); }}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${cat === c ? 'bg-[var(--text)] text-white' : 'border border-line text-muted hover:text-text'}`}>
              {c} <span className="tabular-nums opacity-60">{c === '전체' ? REMIX_SCRIPT_TEMPLATES.length : REMIX_SCRIPT_TEMPLATES.filter((t) => catOf(t) === c).length}</span>
            </button>
          ))}
        </div>
        <ul className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(more ? shown : limited).map((t, k) => {
            const on = t.id === current;
            return (
              <li key={t.id} className="rf-in" style={{ animationDelay: `${Math.min(k, 12) * 45}ms` }}>
                <div className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border-2 bg-white transition duration-300 ${on ? 'border-[var(--amber)] shadow-[0_20px_44px_-24px_rgba(47,59,235,0.7)]' : 'border-line hover:-translate-y-1 hover:shadow-[0_18px_40px_-24px_rgba(14,16,22,0.35)]'}`}>
                  {/* 흐름 띠: 역할을 깔때기 단계 색으로 */}
                  <div className="flex h-1.5" aria-hidden>
                    {t.steps.map((s, i) => <span key={i} className="flex-1" style={{ background: stageOf(s.role, i, t.steps.length).color }} />)}
                  </div>
                  <button type="button" onClick={() => void pick(t.id)} aria-pressed={on} className="flex flex-1 flex-col p-5 text-left">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-[17px] font-bold tracking-[-0.01em] text-text">{t.name}</span>
                      {on
                        ? <span className="shrink-0 rounded-full bg-[var(--amber)] px-2.5 py-0.5 text-[11px] font-bold text-white">사용 중</span>
                        : <span className="shrink-0 rounded-full border border-line px-2.5 py-0.5 text-[11px] font-semibold text-muted opacity-0 transition group-hover:opacity-100">이걸로 쓰기</span>}
                    </span>
                    <span className="mt-1.5 text-sm leading-relaxed text-muted">{t.oneLiner}</span>
                    <span className="mt-auto pt-4 text-[13px] italic leading-snug text-text/80">“{t.steps[0]?.example}”</span>
                  </button>
                  <div className="flex items-center justify-between border-t border-line px-5 py-3">
                    <span className="text-xs tabular-nums text-muted">{t.steps.length}단계 흐름</span>
                    <button type="button" onClick={() => setDetail(t)} className="text-xs font-bold text-[var(--amber)] hover:underline">예시 대본 보기 →</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {shown.length > LIMIT && (
          <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line py-3.5 text-sm font-bold text-muted transition hover:border-[var(--amber)] hover:text-[var(--amber)]">
            {more ? '접기 ↑' : `공식 ${shown.length - limited.length}개 더보기 ↓`}
          </button>
        )}
      </div>

      {detail && (
        <FormulaDetail t={detail} selected={detail.id === current} onUse={() => { void pick(detail.id); setDetail(null); }} onClose={() => setDetail(null)} />
      )}
    </section>
  );
}

/** 예시 대본 팝업: 공식의 예시 문장을 깔때기(주목 → 흥미 → 욕구 → 행동)로 보여 준다 */
function FormulaDetail({ t, selected, onUse, onClose }: { t: RemixScriptTemplate; selected: boolean; onUse: () => void; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const beats = t.steps.map((s) => ({ role: s.role, text: s.example, why: `${s.purpose}. ${s.guidance}` }));
  return (
    <div role="dialog" aria-modal="true" aria-label={`${t.name} 예시 대본`} className="fixed inset-0 z-[70] grid place-items-center bg-[#0b0d14]/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <style>{`
        @keyframes fd-pop { from { opacity: 0; transform: translateY(16px) scale(.97); } to { opacity: 1; transform: none; } }
        .fd-pop { animation: fd-pop .4s cubic-bezier(.2,.8,.2,1) both; }
        @media (prefers-reduced-motion: reduce) { .fd-pop { animation: none !important; } }
      `}</style>
      <div className="fd-pop flex max-h-[90vh] w-[min(96vw,64rem)] flex-col overflow-hidden rounded-3xl bg-white text-[#0f172a] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0e1016] via-[#1b1f3a] to-[#2f3beb] px-7 py-6 text-white">
          <span aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-[#6d5cff]/30 blur-3xl" />
          <button type="button" aria-label="닫기" className="absolute right-5 top-4 text-2xl leading-none text-white/60 hover:text-white" onClick={onClose}>×</button>
          <p className="text-xs font-semibold text-white/60">리믹스 대본 공식 · 예시 대본</p>
          <h3 className="mt-1 text-2xl font-bold tracking-tight">{t.name}</h3>
          <p className="mt-1 text-sm text-white/75">{t.oneLiner}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          <ScriptFunnel beats={beats} roleLabel={ROLE_LABEL} />
          <p className="mt-5 text-xs text-[#94a3b8]">예시 문장이에요. 실제 대본은 고른 장면과 상품에 맞게 새로 써요.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#eef1f6] px-7 py-4">
          <button type="button" className="rounded-full border border-[#e2e8f0] px-4 py-2 text-sm font-semibold text-[#334155] hover:border-[#94a3b8]" onClick={onClose}>닫기</button>
          <button type="button" className="rounded-full bg-[#0f172a] px-5 py-2 text-sm font-bold text-white hover:bg-[#1e293b] disabled:opacity-50" disabled={selected} onClick={onUse}>
            {selected ? '지금 쓰는 공식' : '이 공식으로 쓰기'}
          </button>
        </div>
      </div>
    </div>
  );
}

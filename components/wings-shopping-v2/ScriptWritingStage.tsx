'use client';
import { useEffect, useMemo, useState } from 'react';
import { frameUrl } from '@/lib/wings-shopping-v2/client';
import { remixScriptTemplate } from '@/lib/shotform-remix-script-templates';
import type { Project } from '@/lib/wings-shopping-v2/types';
import { ROLE_LABEL } from './SsulPanel';
import { stageOf } from './ScriptFunnel';

/** 공식을 모를 때 보여 줄 기본 흐름 */
const DEFAULT_STEPS = [
  { role: 'hook', purpose: '첫 3초에 스크롤을 멈추게 할 문장을 고르는 중' },
  { role: 'setup', purpose: '시청자가 공감할 상황을 깔고 있어요' },
  { role: 'product_intro', purpose: '상품이 등장할 순간을 잡는 중' },
  { role: 'proof', purpose: '믿게 만드는 장면과 근거를 붙이는 중' },
  { role: 'cta', purpose: '마지막에 행동하게 만드는 한마디를 다듬는 중' },
];

/**
 * 대본 쓰는 중: 왼쪽 휴대폰에서 고른 장면이 넘어가며 지금 쓰는 문장 역할이 타자처럼 찍히고,
 * 오른쪽에는 대본 공식의 흐름이 한 칸씩 채워진다. (서버 진행률이 거칠어서 단계는 경과 시간으로 보여 줌)
 */
export default function ScriptWritingStage({ project, progress }: { project: Project; progress?: number }) {
  const steps = useMemo(() => {
    if (project.mode === 'remix') return remixScriptTemplate(project.scriptTemplateId).steps.map((s) => ({ role: s.role, purpose: s.purpose }));
    return DEFAULT_STEPS;
  }, [project.mode, project.scriptTemplateId]);
  const frames = useMemo(() => project.clips.filter((c) => !c.excluded).slice(0, 8).map((c) => frameUrl(project.id, c.id)), [project.clips, project.id]);
  const product = project.analysis?.productName;

  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 120);
    return () => clearInterval(t);
  }, []);
  const sec = (now - start) / 1000;
  // 약 30초 동안 흐름을 한 칸씩 (끝나도 마지막 칸에서 기다림)
  const per = 30 / steps.length;
  const active = Math.min(steps.length - 1, Math.floor(sec / per));
  const within = Math.min(1, (sec - active * per) / per);
  const cur = steps[active]!;
  const typed = cur.purpose.slice(0, Math.ceil(cur.purpose.length * Math.min(1, within * 1.6)));
  const frame = frames.length ? frames[Math.floor(sec / 2.2) % frames.length] : null;
  const pct = typeof progress === 'number' && progress > 0.3 ? Math.max(progress, sec / 40) : Math.min(0.95, sec / 40);

  return (
    <div role="status" aria-live="polite" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0e1016] via-[#161a2e] to-[#232a6b] p-6 text-white md:p-8">
      <style>{`
        @keyframes ws-caret { 50% { opacity: 0; } }
        @keyframes ws-fade { from { opacity: 0; transform: scale(1.04); } to { opacity: 1; transform: none; } }
        @keyframes ws-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(122,134,255,.55); } 50% { box-shadow: 0 0 0 8px rgba(122,134,255,0); } }
        @keyframes ws-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .ws-caret { animation: ws-caret 1s step-end infinite; }
        .ws-fade { animation: ws-fade .8s ease both; }
        .ws-glow { animation: ws-glow 1.6s ease-out infinite; }
        .ws-float { animation: ws-float 5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .ws-caret, .ws-fade, .ws-glow, .ws-float { animation: none !important; } }
      `}</style>
      <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#6d5cff]/25 blur-3xl" />
      <span aria-hidden className="pointer-events-none absolute -bottom-28 left-10 h-64 w-64 rounded-full bg-[#2f3beb]/25 blur-3xl" />

      <div className="relative grid items-center gap-8 md:grid-cols-[200px_minmax(0,1fr)]">
        {/* 휴대폰: 장면이 넘어가고 지금 쓰는 문장 역할이 타자처럼 찍힘 */}
        <div className="ws-float mx-auto w-full max-w-[200px] rounded-[2rem] bg-[#05060a] p-2 shadow-[0_30px_60px_-24px_rgba(0,0,0,0.8)] ring-1 ring-white/10">
          <div className="relative aspect-[9/16] overflow-hidden rounded-[1.6rem] bg-[#1b1f2e]">
            {frame && <img key={frame} src={frame} alt="" className="ws-fade absolute inset-0 h-full w-full object-cover opacity-80" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/40" />
            <span className="absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: stageOf(cur.role, active, steps.length).color }}>
              {ROLE_LABEL[cur.role] ?? cur.role}
            </span>
            <p className="absolute inset-x-3 bottom-6 text-center text-[13px] font-bold leading-snug [text-shadow:0_2px_8px_#000]">
              {typed}<span className="ws-caret ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-white" />
            </p>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold text-white/55">AI 작가가 대본을 쓰고 있어요 · {Math.floor(sec)}초</p>
          <h3 className="mt-1 text-xl font-bold leading-snug tracking-[-0.02em] md:text-2xl">
            {product ? <>「{product}」<br className="md:hidden" /> 장면에 맞춰 한 문장씩</> : '장면에 맞춰 한 문장씩 쓰는 중'}
          </h3>

          {/* 공식 흐름 */}
          <ol className="mt-6 space-y-2.5">
            {steps.map((s, i) => {
              const done = i < active;
              const on = i === active;
              const color = stageOf(s.role, i, steps.length).color;
              return (
                <li key={i} className={`flex items-center gap-3 transition duration-500 ${i > active ? 'opacity-35' : ''}`}>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${on ? 'ws-glow' : ''}`}
                    style={{ background: done || on ? color : 'rgba(255,255,255,.08)', color: done || on ? '#fff' : 'rgba(255,255,255,.5)' }}>
                    {done ? '✓' : i + 1}
                  </span>
                  <span className="w-20 shrink-0 text-sm font-bold">{ROLE_LABEL[s.role] ?? s.role}</span>
                  <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-200" style={{ width: `${done ? 100 : on ? within * 100 : 0}%`, background: `linear-gradient(90deg, ${color}, ${color}99)` }} />
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="mt-6">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-[#7a86ff] via-[#a78bfa] to-[#22d3ee] transition-[width] duration-700" style={{ width: `${Math.round(pct * 100)}%` }} />
            </div>
            <p className="mt-2 text-xs text-white/55">보통 20~40초 걸려요. 다 쓰면 문장마다 장면이 붙은 대본이 나타나요.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import {
  STORY_SCRIPT_TEMPLATES,
  STORY_SCRIPT_TEMPLATE_IDS,
  type StoryScriptTemplateGroup,
} from '@/app/WingsAIStudioShotForm/story-shopping/story-script-catalog';
import StructureDetail from './StructureDetail';

type Structure = { id: string; name: string; oneLiner: string; roles: string[]; custom?: boolean; evidence?: string };

const STORY_PREFIX = 'story:';
const GROUPS: Array<{ id: StoryScriptTemplateGroup; label: string; hint: string }> = [
  { id: 'ssul', label: '썰채널 인기 공식', hint: '조회수 높은 썰쇼핑 채널 대본에서 뽑은 전개' },
  { id: 'classic', label: '기본 스토리 공식', hint: '어떤 제품에도 쓰기 쉬운 기본 전개' },
];
// 카드마다 다른 옅은 바탕색 (스토리쇼핑숏폼 선택 화면과 같은 느낌)
const TINTS = ['#e8eefc', '#fbe9ee', '#e6f2fb', '#e5f5ef', '#f1ecfb', '#fdf1e2'];

/** 대본 구조 고르기: 스토리쇼핑숏폼(v1) 스토리 공식 + 썰 쇼핑 분석 구조 + 자동 */
export default function ScriptFormulaPicker({
  projectId,
  value,
  structures,
  roleLabel,
  autoReason,
  onChange,
}: {
  projectId: string;
  value: string;
  structures: Structure[];
  roleLabel: Record<string, string>;
  autoReason?: string;
  onChange: (structureId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<{ id: string; name: string; english: string; sub: string; flow: string } | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !detail) setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, detail]);

  const storyId = value.startsWith(STORY_PREFIX) ? value.slice(STORY_PREFIX.length) : '';
  const story = storyId ? STORY_SCRIPT_TEMPLATES[storyId as keyof typeof STORY_SCRIPT_TEMPLATES] : undefined;
  const structure = structures.find((s) => s.id === value);
  const current = story
    ? { name: story.name, sub: story.description, flow: story.flow }
    : structure
      ? { name: structure.name, sub: structure.oneLiner, flow: structure.roles.map((r) => roleLabel[r] ?? r).join(' → ') }
      : { name: '자동 추천', sub: autoReason ?? '상품 정보를 보고 AI가 가장 맞는 구조를 고릅니다.', flow: '' };

  const pick = (id: string) => { onChange(id); setOpen(false); };
  const card = (id: string, i: number, name: string, english: string, sub: string, flow: string) => {
    const on = value === id;
    return (
      <li key={id} className="relative">
        {id !== 'auto' && (
          <button type="button" onClick={() => setDetail({ id, name, english, sub, flow })}
            className="absolute bottom-3 right-3 z-10 rounded-full bg-[#0f172a] px-3 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#334155]">
            상세보기
          </button>
        )}
        <button
          type="button"
          onClick={() => pick(id)}
          aria-pressed={on}
          className={`flex h-full w-full flex-col rounded-2xl border-2 p-4 pb-12 text-left transition ${on ? 'border-amber shadow-md' : 'border-transparent hover:border-line'}`}
          style={{ background: TINTS[i % TINTS.length] }}
        >
          <span className="flex items-start justify-between gap-2">
            <span className="text-base font-bold text-[#18181b]">{name}</span>
            {on && <span className="rounded-full bg-amber px-2 py-0.5 text-[11px] font-bold text-amber-ink">선택됨</span>}
          </span>
          {english && <span className="mt-0.5 text-[10px] font-semibold tracking-wider text-[#71717a]">{english}</span>}
          <span className="mt-2 text-sm text-[#3f3f46]">{sub}</span>
          {flow && <span className="mt-3 rounded-lg bg-white/70 px-2.5 py-2 text-xs leading-relaxed text-[#52525b]">{flow}</span>}
        </button>
      </li>
    );
  };

  return (
    <>
      <div className="rounded-2xl border border-line bg-gradient-to-br from-[#fff8f1] to-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted">대본 구조</p>
            <p className="mt-1 text-lg font-bold tracking-tight text-text">{current.name}</p>
            <p className="mt-0.5 text-sm text-muted">{current.sub}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-text shadow-sm transition hover:border-amber hover:text-amber"
          >
            구조 바꾸기
          </button>
        </div>
        {current.flow && (
          <ol className="mt-4 flex flex-wrap items-center gap-y-2" aria-label="이야기 흐름">
            {current.flow.split(/\s*→\s*/).map((part, i) => (
              <li key={i} className="flex items-center">
                {i > 0 && <span aria-hidden className="mx-1.5 h-px w-3 bg-line" />}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs text-text ring-1 ring-line">
                  <span className="font-semibold tabular-nums text-amber">{i + 1}</span>
                  {part}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="대본 구조 선택" className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[88vh] w-[min(96vw,72rem)] overflow-y-auto rounded-2xl bg-white p-6 text-[#18181b] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">대본 구조 선택</h3>
                <p className="mt-1 text-sm text-[#71717a]">제품 이야기를 가장 잘 전달할 전개를 고르세요.</p>
              </div>
              <button type="button" aria-label="닫기" className="rounded-full px-2 text-2xl leading-none text-[#71717a] hover:text-[#18181b]" onClick={() => setOpen(false)}>×</button>
            </div>

            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {card('auto', 0, '자동 추천', '', '상품 정보를 보고 AI가 가장 맞는 구조를 고릅니다.', '')}
            </ul>

            {GROUPS.map((g) => {
              const ids = STORY_SCRIPT_TEMPLATE_IDS.filter((id) => STORY_SCRIPT_TEMPLATES[id].group === g.id);
              if (!ids.length) return null;
              return (
                <section key={g.id} className="mt-6">
                  <h4 className="text-base font-bold">{g.label} <span className="ml-1 text-xs font-normal text-[#71717a]">{g.hint}</span></h4>
                  <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {ids.map((id, i) => {
                      const t = STORY_SCRIPT_TEMPLATES[id];
                      return card(STORY_PREFIX + id, i, t.name, t.english, t.description, t.flow);
                    })}
                  </ul>
                </section>
              );
            })}

            <section className="mt-6">
              <h4 className="text-base font-bold">내 구조 템플릿 <span className="ml-1 text-xs font-normal text-[#71717a]">잘 된 벤치마크 영상에서 그대로 뽑은 구조</span></h4>
              {structures.some((s) => s.custom) ? (
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {structures.filter((s) => s.custom).map((s, i) => card(s.id, i + 3, s.name, s.evidence ?? '', s.oneLiner, s.roles.map((r) => roleLabel[r] ?? r).join(' → ')))}
                </ul>
              ) : (
                <p className="mt-2 rounded-xl border border-dashed border-[#d4d4d8] px-4 py-3 text-sm text-[#71717a]">아직 없어요. AI 영상 분석 단계에서 「이 영상 구조를 템플릿으로 저장」을 누르면 여기에 생겨요.</p>
              )}
            </section>

            {structures.some((s) => !s.custom) && (
              <section className="mt-6">
                <h4 className="text-base font-bold">썰 쇼핑 분석 구조 <span className="ml-1 text-xs font-normal text-[#71717a]">상위 썰 쇼핑 쇼츠를 문장 단위로 분석한 구조</span></h4>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {structures.filter((s) => !s.custom).map((s, i) => card(s.id, i + 2, s.name, '', s.oneLiner, s.roles.map((r) => roleLabel[r] ?? r).join(' → ')))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}
      {detail && (
        <StructureDetail
          projectId={projectId}
          structureId={detail.id}
          name={detail.name}
          english={detail.english}
          description={detail.sub}
          flow={detail.flow}
          roleLabel={roleLabel}
          selected={value === detail.id}
          onUse={() => { setDetail(null); pick(detail.id); }}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}

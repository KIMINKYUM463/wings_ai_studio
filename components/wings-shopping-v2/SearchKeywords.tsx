'use client';
import { useState } from 'react';
import { patchProject } from '@/lib/wings-shopping-v2/client';
import type { Project } from '@/lib/wings-shopping-v2/types';

type Q = NonNullable<Project['analysis']>['searchQueries'];

/**
 * 검색어 고치기: AI가 정한 검색어를 빼거나 더한다.
 * 한국어·영어 검색어는 유튜브·틱톡·인스타그램에, 중국어 검색어는 더우인·샤오홍슈에 쓴다.
 */
export default function SearchKeywords({ project, setProject, disabled }: { project: Project; setProject: (p: Project) => void; disabled?: boolean }) {
  const q = project.analysis?.searchQueries;
  const global = uniq([...(q?.youtube ?? []), ...(q?.tiktok ?? []), ...(q?.instagram ?? [])]);
  const china = uniq([...(q?.douyin ?? []), ...(q?.xiaohongshu ?? [])]);

  const save = async (next: Partial<Q>) => {
    if (!project.analysis) return;
    const merged = { ...project.analysis.searchQueries, ...next };
    setProject({ ...project, analysis: { ...project.analysis, searchQueries: merged } });
    setProject(await patchProject(project.id, { searchQueries: next }));
  };
  const setGlobal = (list: string[]) => save({ youtube: list, tiktok: list, instagram: list });
  const setChina = (list: string[]) => save({ douyin: list, xiaohongshu: list });

  return (
    <div className="mt-4 space-y-2.5">
      <Row label="유튜브·틱톡·인스타그램" items={global} onChange={setGlobal} disabled={disabled} placeholder="검색어 추가 (예: 사과 깎는 기계)" />
      <Row label="더우인·샤오홍슈 (중국어)" items={china} onChange={setChina} disabled={disabled} placeholder="중국어 검색어 추가 (예: 削苹果神器)" />
    </div>
  );
}

function Row({ label, items, onChange, disabled, placeholder }: { label: string; items: string[]; onChange: (list: string[]) => void; disabled?: boolean; placeholder: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) { setDraft(''); return; }
    // 새 검색어를 맨 앞에: 검색은 앞쪽 몇 개만 쓰므로 방금 넣은 말이 꼭 검색되게 (8개를 넘으면 맨 뒤가 빠짐)
    onChange([v, ...items.filter((x) => x !== v)].slice(0, 8));
    setDraft('');
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-44 shrink-0 text-xs font-semibold text-muted">{label}</span>
      {items.map((k, i) => (
        <span key={k} className={`inline-flex items-center gap-1 rounded-full py-1 pl-3 pr-1.5 text-xs ${i < 2 ? 'bg-[color-mix(in_srgb,var(--amber)_10%,white)] font-semibold text-text ring-1 ring-[color-mix(in_srgb,var(--amber)_30%,transparent)]' : 'bg-panel-2 text-text'}`}>
          {k}
          <button type="button" disabled={disabled} aria-label={`${k} 빼기`} onClick={() => onChange(items.filter((x) => x !== k))}
            className="grid h-4 w-4 place-items-center rounded-full text-[10px] text-muted hover:bg-black/10 hover:text-text">×</button>
        </span>
      ))}
      <form onSubmit={(e) => { e.preventDefault(); add(); }} className="inline-flex">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} disabled={disabled} maxLength={40} placeholder={placeholder}
          className="w-52 rounded-full border border-dashed border-line bg-white px-3 py-1 text-xs text-text placeholder:text-[#a3a8b6] focus:border-[var(--amber)] focus:outline-none" />
      </form>
    </div>
  );
}

const uniq = (a: string[]) => [...new Set(a.map((s) => s.trim()).filter(Boolean))];

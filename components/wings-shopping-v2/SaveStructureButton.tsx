'use client';
import { useState } from 'react';
import { api } from '@/lib/wings-shopping-v2/client';
import type { Project } from '@/lib/wings-shopping-v2/types';
import { resetSsulOptions } from './SsulPanel';

/** 분석한 벤치마크 영상의 대본 구조를 '내 구조 템플릿'으로 저장 (다른 상품 대본에 그대로 씀) */
export default function SaveStructureButton({ project }: { project: Project }) {
  const [name, setName] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  async function save() {
    setState('saving');
    setMsg('');
    try {
      const r = await api<{ structure: { name: string; oneLiner: string } }>('/api/wings-shopping-v2/structures', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, name }),
      });
      resetSsulOptions();
      setState('saved');
      setMsg(`「${r.structure.name}」 저장됨 · ${r.structure.oneLiner}`);
    } catch (e) {
      setState('error');
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="mt-7 rounded-xl border border-line p-4">
      <p className="text-sm font-semibold text-text">이 영상 구조를 템플릿으로 저장</p>
      <p className="mt-0.5 text-xs text-muted">훅·전개·마무리 순서와 문장 비중을 그대로 뽑아 두면, 다른 상품 대본을 쓸 때 「대본 구조 → 내 구조 템플릿」에서 고를 수 있어요.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input className="field min-w-0 flex-1" value={name} maxLength={30} placeholder="템플릿 이름 (비우면 AI가 지어요)"
          onChange={(e) => setName(e.target.value)} disabled={state === 'saving'} />
        <button type="button" className="btn btn-primary" onClick={save} disabled={state === 'saving'}>
          {state === 'saving' ? '구조 뽑는 중...' : state === 'saved' ? '한 번 더 저장' : '구조 저장'}
        </button>
      </div>
      {msg && <p aria-live="polite" className={`mt-2 text-sm ${state === 'error' ? 'text-danger' : 'text-text'}`}>{msg}</p>}
    </div>
  );
}

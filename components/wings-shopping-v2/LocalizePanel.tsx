'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { v2ProjectHref } from '@/lib/wings-shopping-v2/nav';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/wings-shopping-v2/client';
import { shotformVmakeApiKey, shotformVmakeSecretAccessKey } from '@/lib/shotform-vmake-subtitle-removal';
import type { JobStatus, Project, Stage } from '@/lib/wings-shopping-v2/types';
import { Panel } from './ui';

type Info = {
  langs: { id: string; name: string; market: string }[];
  versions: { id: string; lang?: string; name: string; hasOutput: boolean; jobs: Partial<Record<Stage, JobStatus>> }[];
};

function status(v: Info['versions'][number]): string {
  const j = v.jobs;
  if (j.render?.state === 'running') return j.render.message ?? '영상 만드는 중';
  if (j.tts?.state === 'running') return j.tts.message ?? '음성 만드는 중';
  if (j.tts?.state === 'error') return `음성 오류: ${j.tts.message ?? ''}`;
  if (j.render?.state === 'error') return `렌더 오류: ${j.render.message ?? ''}`;
  return v.hasOutput ? '완성' : '대기';
}

/** 해외판: 같은 장면으로 다른 나라 말 대본·음성·자막 */
export default function LocalizePanel({ project, onOpen }: { project: Project; onOpen?: (id: string) => void }) {
  const pathname = usePathname();
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => api<Info>(`/api/wings-shopping-v2/projects/${project.id}/localize`).then(setInfo).catch(() => {}), [project.id]);
  useEffect(() => { void load(); }, [load]);
  const working = info?.versions.some((v) => v.jobs.tts?.state === 'running' || v.jobs.render?.state === 'running');
  useEffect(() => {
    if (!working) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [working, load]);

  if (project.lang && project.lang !== 'ko') return null;
  const make = async (lang: string) => {
    setBusy(lang);
    setError(null);
    try {
      await api(`/api/wings-shopping-v2/projects/${project.id}/localize`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang, vmakeApiKey: shotformVmakeApiKey() || undefined, vmakeSecretAccessKey: shotformVmakeSecretAccessKey() || undefined }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel title="해외판 만들기">
      <p className="-mt-2 mb-4 text-sm text-muted">
        같은 장면·싱크 구조로 현지 말투 대본·음성·자막을 새로 만듭니다 (원화 가격·국내 쇼핑몰 이름은 현지에 맞게 바꿈). 번역 후 음성·영상까지 자동으로 이어집니다.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(info?.langs ?? []).map((l) => {
          const done = info?.versions.filter((v) => v.lang === l.id) ?? [];
          return (
            <div key={l.id} className="rounded-xl border border-line p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{l.name}</span>
                <button className="btn btn-ghost !px-2.5 !py-1 text-xs" disabled={!!busy || !project.script?.beats.length} onClick={() => make(l.id)}>
                  {busy === l.id ? '번역 중...' : done.length ? '다시 만들기' : '만들기'}
                </button>
              </div>
              <p className="mt-1 text-xs text-muted">{l.market}</p>
              {done.map((v) => onOpen ? (
                <button key={v.id} type="button" onClick={() => onOpen(v.id)} className="mt-1.5 block truncate text-left text-xs text-amber hover:underline">
                  {status(v)} → 이 화면에서 열기
                </button>
              ) : (
                <Link key={v.id} href={v2ProjectHref(pathname, v.id, project.mode)} className="mt-1.5 block truncate text-xs text-amber hover:underline">
                  {status(v)} → 열기
                </Link>
              ))}
            </div>
          );
        })}
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </Panel>
  );
}

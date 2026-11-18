'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { v2ProjectHref } from '@/lib/wings-shopping-v2/nav';
import { useEffect, useState } from 'react';
import { api } from '@/lib/wings-shopping-v2/client';
import type { Project } from '@/lib/wings-shopping-v2/types';

type Info = { langs: { id: string; name: string }[]; versions: { id: string; lang?: string; hasOutput: boolean }[] };

/**
 * 한국어 원본 ↔ 해외판 전환. 해외판을 만들어도 언제든 한국어로 돌아갈 수 있게 한다.
 * onOpen 이 있으면(썰쇼핑숏폼) 같은 화면 안에서 바꾸고, 없으면 해당 프로젝트 화면으로 이동한다.
 */
export default function LangSwitch({ project, onOpen }: { project: Project; onOpen?: (id: string) => void }) {
  const rootId = project.localizedFrom ?? project.id;
  const pathname = usePathname();
  const [info, setInfo] = useState<Info | null>(null);
  useEffect(() => {
    let alive = true;
    api<Info>(`/api/wings-shopping-v2/projects/${rootId}/localize`).then((d) => { if (alive) setInfo(d); }).catch(() => {});
    return () => { alive = false; };
  }, [rootId, project.jobs.render?.state]);

  if (!info?.versions.length) return null;
  const items = [
    { id: rootId, label: '한국어 (원본)' },
    ...info.versions.map((v) => ({ id: v.id, label: info.langs.find((l) => l.id === v.lang)?.name ?? v.lang ?? '해외판' })),
  ];

  return (
    <nav aria-label="언어 버전" className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs text-muted">언어</span>
      {items.map((it) => {
        const on = it.id === project.id;
        const cls = `rounded-full px-3 py-1 text-xs font-semibold ${on ? 'bg-amber text-amber-ink' : 'border border-line text-muted hover:text-text'}`;
        return onOpen ? (
          <button key={it.id} type="button" aria-current={on} className={cls} onClick={() => onOpen(it.id)}>{it.label}</button>
        ) : (
          <Link key={it.id} href={v2ProjectHref(pathname, it.id, project.mode)} aria-current={on} className={cls}>{it.label}</Link>
        );
      })}
      {project.localizedFrom && (
        onOpen
          ? <button type="button" className="ml-1 text-xs font-semibold text-amber hover:underline" onClick={() => onOpen(rootId)}>← 한국어로 돌리기</button>
          : <Link href={v2ProjectHref(pathname, rootId, project.mode)} className="ml-1 text-xs font-semibold text-amber hover:underline">← 한국어로 돌리기</Link>
      )}
    </nav>
  );
}

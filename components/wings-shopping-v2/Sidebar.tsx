'use client';
import '@/lib/wings-shopping-v2/browser-keys';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { modeLabel } from '@/lib/wings-shopping-v2/modes';
import { v2NavFromPath } from '@/lib/wings-shopping-v2/nav';

type Item = { id: string; name: string; createdAt: string; hasOutput: boolean; mode?: string; lang?: string };

export default function Sidebar() {
  const [items, setItems] = useState<Item[]>([]);
  const pathname = usePathname();
  const nav = useMemo(() => v2NavFromPath(pathname), [pathname]);

  useEffect(() => {
    fetch('/api/wings-shopping-v2/projects')
      .then((r) => r.json())
      .then(setItems)
      .catch(() => {});
  }, [pathname]);

  const visible = useMemo(() => {
    if (!nav.modeFilter) return items;
    return items.filter((p) => nav.modeFilter!.includes(p.mode ?? 'remix'));
  }, [items, nav.modeFilter]);

  return (
    <aside className="v2-rail flex w-full shrink-0 flex-col border-b px-3 py-4 md:w-60 md:border-b-0 md:border-r md:py-5">
      <Link href="/WingsAIStudioShotForm" className="inline-flex items-center gap-1 px-2 text-sm font-medium">
        ← 메인으로
      </Link>
      <Link href="/WingsAIStudioShotForm?settings=open" className="mt-1 inline-flex items-center px-2 text-sm">
        API 설정
      </Link>
      <Link href={nav.base} className="v2-rail__brand mt-4 px-2 font-display text-2xl tracking-tight">
        {nav.title}
      </Link>
      <Link href={nav.base} className="btn btn-primary mt-5 w-full">
        새 프로젝트
      </Link>
      <p className="v2-rail__label mt-6 px-2 text-xs">프로젝트</p>
      <nav className="mt-2 flex max-h-40 flex-col gap-0.5 overflow-y-auto md:max-h-none md:flex-1">
        {visible.length === 0 && <p className="v2-rail__empty px-2 py-1 text-sm">아직 없습니다</p>}
        {visible.map((p) => {
          const href = `${nav.base}/projects/${p.id}`;
          const active = pathname === href;
          return (
            <Link
              key={p.id}
              href={href}
              className={`v2-rail__item block px-2 py-2 text-sm transition-colors ${active ? 'is-active' : ''}`}
            >
              <span className="block truncate">{p.name}</span>
              <span className="v2-rail__meta text-xs">
                {modeLabel(p.mode, p.lang, true)} · {new Date(p.createdAt).toLocaleDateString('ko-KR')}
                {p.hasOutput ? ' · 완성본' : ''}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

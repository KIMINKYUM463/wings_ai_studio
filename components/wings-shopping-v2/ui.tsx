'use client';
import type { JobStatus, Project } from '@/lib/wings-shopping-v2/types';

export const STEPS = ['영상 분석', '제품 찾기', '영상 선택', '대본·음성', '내보내기'] as const;

/** 각 단계가 열릴 수 있는지 */
export function stepAvailable(p: Project, i: number): boolean {
  switch (i) {
    case 0: return true;
    case 1: return !!p.analysis;
    case 2: return !!p.analysis && p.selected.length > 0;
    case 3: return p.clips.some((c) => !c.excluded);
    case 4: return !!p.script?.beats.length;
    default: return false;
  }
}

export function Stepper({ project, current, onSelect }: { project: Project; current: number; onSelect: (i: number) => void }) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label="진행 단계">
      {STEPS.map((s, i) => {
        const ok = stepAvailable(project, i);
        const active = i === current;
        return (
          <li key={s}>
            <button
              onClick={() => onSelect(i)}
              disabled={!ok}
              aria-current={active ? 'step' : undefined}
              className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors disabled:opacity-35 ${
                active ? 'border-amber bg-amber text-amber-ink font-semibold' : 'border-line text-muted hover:text-text'
              }`}
            >
              <span className="font-display">{i + 1}</span>{s}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function JobLine({ job, idleText }: { job?: JobStatus; idleText?: string }) {
  if (!job || job.state === 'idle') return idleText ? <p className="text-sm text-muted">{idleText}</p> : null;
  if (job.state === 'running') {
    return (
      <div className="flex items-center gap-3 text-sm" role="status">
        <span className="h-2 w-28 overflow-hidden rounded-full bg-panel-2">
          <span className="block h-full bg-amber transition-all" style={{ width: `${Math.round((job.progress ?? 0.05) * 100)}%` }} />
        </span>
        <span>{job.message ?? '처리 중...'}</span>
      </div>
    );
  }
  if (job.state === 'error') return <p className="text-sm text-danger" role="alert">{job.message}</p>;
  return null;
}

export function Panel({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">{title}</h2>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export const PLATFORM_LABEL: Record<string, string> = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', douyin: '더우인', xiaohongshu: '샤오홍슈', upload: '업로드', other: '기타' };
export const PLATFORM_COLOR: Record<string, string> = { youtube: '#ff4e45', tiktok: '#25f4ee', instagram: '#e1306c', douyin: '#fe2c55', xiaohongshu: '#ff2442', upload: '#8a93b5', other: '#8a93b5' };

export function PlatformTag({ platform }: { platform?: string }) {
  const p = platform ?? 'other';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className="h-2 w-2 rounded-full" style={{ background: PLATFORM_COLOR[p] ?? '#8a93b5' }} />
      {PLATFORM_LABEL[p] ?? p}
    </span>
  );
}

export const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
